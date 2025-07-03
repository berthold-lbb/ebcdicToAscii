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
    public Step stepConversionEbcdic(JobRepository jobRepository, PlatformTransactionManager transactionManager) {
        return new StepBuilder("stepConversionEbcdic", jobRepository)
                .tasklet(conversionEbcdicTasklet(null, null), transactionManager)
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
