@Component
public class EbcdicConversionTasklet implements Tasklet {

    @Value("#{jobParameters['job.fichier.nom.lecture']}")
    private String nomFichier;

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) throws Exception {
        String inputFile = nomFichier;
        String outputFile = inputFile + "_ascii.txt"; // fichier intermédiaire en ASCII

        boolean success = EbcdicOutils.plcConvert(inputFile, outputFile);
        if (!success) {
            throw new IllegalStateException("Erreur pendant la conversion EBCDIC vers ASCII");
        }

        // Stocke le nom du fichier converti pour l'étape suivante
        ExecutionContext stepContext = chunkContext.getStepContext().getStepExecution().getJobExecution().getExecutionContext();
        stepContext.put("fichierConverti", outputFile);

        return RepeatStatus.FINISHED;
    }
}


@Configuration
public class BatchConfiguration {

    @Autowired
    private EbcdicConversionTasklet conversionTasklet;

    @Autowired
    private JobBuilderFactory jobBuilderFactory;

    @Autowired
    private StepBuilderFactory stepBuilderFactory;

    @Bean
    public Job jobConversionPuisLecture(Step stepConversion, Step stepLecture) {
        return jobBuilderFactory.get("jobConversionPuisLecture")
            .start(stepConversion)
            .next(stepLecture)
            .build();
    }

    @Bean
    public Step stepConversion() {
        return stepBuilderFactory.get("stepConversion")
            .tasklet(conversionTasklet)
            .build();
    }

    @Bean
    public Step stepLecture(FlatFileItemReader<RubanSicDto> reader, ItemProcessor<RubanSicDto, RubanSicDto> processor, ItemWriter<RubanSicDto> writer) {
        return stepBuilderFactory.get("stepLecture")
            .<RubanSicDto, RubanSicDto>chunk(100)
            .reader(reader)
            .processor(processor)
            .writer(writer)
            .build();
    }
}


@Bean
@StepScope
public Tasklet conversionEbcdicTasklet(
        @Value("#{jobParameters['job.fichier.nom.lecture']}") String fichierEBCDIC
) {
    return (StepContribution contribution, ChunkContext chunkContext) -> {
        // 1. Créer un fichier temporaire pour la sortie ASCII
        Path tempFile = Files.createTempFile("converted_", ".txt");
        String fichierConverti = tempFile.toAbsolutePath().toString();

        // 2. Conversion EBCDIC → ASCII
        boolean success = EbcdicOutils.plcConvert(fichierEBCDIC, fichierConverti);
        if (!success) throw new IllegalStateException("Échec conversion EBCDIC → ASCII");

        // 3. Stocke le chemin dans le contexte d’exécution du job
        chunkContext.getStepContext().getStepExecution()
            .getJobExecution().getExecutionContext()
            .putString("fichierConverti", fichierConverti);

        return RepeatStatus.FINISHED;
    };
}




@Configuration
public class BatchFluxPremierJourChargementConfiguration {
    public static final String JOB_NAME = "jobFluxPremierJourChargement";

    @Value("${chunk.size:5}")
    private int chunkSize;

    @Bean
    public Job jobFluxPremierJourChargement(
            JobRepository jobRepository,
            @Qualifier("stepConversionEbcdic") Step stepConversionEbcdic,
            @Qualifier("stepChargementFluxPremierJour") Step stepChargementFluxPremierJour,
            @Qualifier("stepCleanupFichierConverti") Step stepCleanupFichierConverti,
            LogJobListener logJobListener) {
        return new JobBuilder(JOB_NAME, jobRepository)
                .start(stepConversionEbcdic)
                .next(stepChargementFluxPremierJour)
                .next(stepCleanupFichierConverti)
                .listener(logJobListener)
                .build();
    }

    /**
     * Step de conversion EBCDIC -> ASCII
     */
    @Bean
    public Step stepCleanupFluxPremierJour(
        JobRepository jobRepository,
        PlatformTransactionManager transactionManager) {

        return new StepBuilder("stepCleanupFluxPremierJour", jobRepository)
            .tasklet(cleanupFichierConvertiTasklet(null), transactionManager)
            .build();
    }

    @Bean
    @StepScope
    public ConversionEbcdicTasklet conversionEbcdicTasklet(
            @Value("#{jobParameters['job.fichier.nom.lecture']}") String nomFichierEbcdic,
            @Value("#{jobExecutionContext['fichierConverti']}") String fichierConverti
    ) {
        return new ConversionEbcdicTasklet(nomFichierEbcdic, fichierConverti);
    }

    /**
     * Step principal de lecture/traitement du fichier converti
     */
    @Bean
    public Step stepChargementFluxPremierJour(
            JobRepository jobRepository,
            PlatformTransactionManager transactionManager,
            @Qualifier("beanLectureFluxPremierJourChargement") FlatFileItemReader<RubanSicDto> reader,
            // ... autres beans comme processor, writer, listener
    ) {
        return new StepBuilder("stepChargementFluxPremierJour", jobRepository)
                .<RubanSicDto, RubanSicDto>chunk(chunkSize, transactionManager)
                .reader(reader)
                // .processor(processor)
                // .writer(writer)
                // .listener(listener)
                .build();
    }

    /**
     * Step de suppression du fichier converti
     */
    @Bean
    @StepScope
    public Tasklet cleanupFichierConvertiTasklet(
            @Value("#{jobExecutionContext['fichierConverti']}") String fichierConverti
    ) {
        return (contribution, chunkContext) -> {
            if (fichierConverti != null && !fichierConverti.isBlank()) {
                try {
                    Files.deleteIfExists(Path.of(fichierConverti));
                    System.out.println("Fichier temporaire supprimé : " + fichierConverti);
                } catch (Exception e) {
                    System.err.println("Erreur lors de la suppression du fichier temporaire : " + fichierConverti);
                    e.printStackTrace();
                }
            }
            return RepeatStatus.FINISHED;
        };
    }

    @Bean
    public Step stepCleanupFichierConverti(JobRepository jobRepository, PlatformTransactionManager transactionManager) {
        return new StepBuilder("stepCleanupFichierConverti", jobRepository)
                .tasklet(cleanupFichierConvertiTasklet(null), transactionManager)
                .build();
    }
}



@Bean
@StepScope
public Tasklet conversionEbcdicTasklet(
    @Value("#{jobParameters['job.fichier.nom.lecture']}") String nomFichier,
    MFTClient mftClient) {

    return (contribution, chunkContext) -> {

        // 1. Télécharger le fichier depuis le MFT
        InputStream inputStream = new MftFileResourceBuilder()
            .mftClient(mftClient)
            .nomConfiguration("flux_premier_jour_lecture")
            .nomFichier(nomFichier)
            .build()
            .getInputStream();

        // 2. Créer un fichier temporaire .ebc pour la conversion
        Path fichierTempEBCDIC = Files.createTempFile("source_", ".ebc");
        Files.copy(inputStream, fichierTempEBCDIC, StandardCopyOption.REPLACE_EXISTING);

        // 3. Créer un fichier temporaire .txt pour la sortie ASCII
        Path fichierTempASCII = Files.createTempFile("converted_", ".txt");

        // 4. Lancer la conversion
        boolean success = EbcdicOutils.plcConvert(
            fichierTempEBCDIC.toAbsolutePath().toString(),
            fichierTempASCII.toAbsolutePath().toString());

        if (!success) {
            throw new IllegalStateException("Échec conversion EBCDIC → ASCII");
        }

        // 5. Stocker le fichier converti dans le contexte
        chunkContext.getStepContext().getStepExecution()
            .getJobExecution().getExecutionContext()
            .putString("fichierConverti", fichierTempASCII.toAbsolutePath().toString());

        return RepeatStatus.FINISHED;
    };
}
