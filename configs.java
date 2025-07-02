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
