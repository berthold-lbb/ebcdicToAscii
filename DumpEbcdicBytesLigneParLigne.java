import java.io.*;
import java.nio.file.Files;
import java.nio.file.Paths;

public class DumpEbcdicBytesLigneParLigne {

    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: java DumpEbcdicBytesLigneParLigne <fichier_entree> <fichier_sortie>");
            return;
        }

        String inputPath = args[0];
        String outputPath = args[1];
        int lineLength = 1390; // ⚠️ adapte cette taille si nécessaire

        try (
            BufferedInputStream bis = new BufferedInputStream(new FileInputStream(inputPath));
            BufferedWriter writer = Files.newBufferedWriter(Paths.get(outputPath))
        ) {
            byte[] buffer = new byte[lineLength];
            int lineNumber = 1;
            int bytesRead;

            while ((bytesRead = bis.read(buffer)) != -1) {
                writer.write("===== Ligne " + lineNumber + " =====\n");

                StringBuilder hexLine = new StringBuilder();
                for (int i = 0; i < bytesRead; i++) {
                    hexLine.append(String.format("%02X ", buffer[i]));
                }

                writer.write(hexLine.toString().trim());
                writer.write("\n\n");

                lineNumber++;
            }

            System.out.println("✅ Dump terminé : " + outputPath);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    @MockBean
private MFTClient mftClient;

@MockBean
private MftFileResourceBuilder mftFileResourceBuilder;

@MockBean
private MftFileResource mftFileResource;

// ...

@Test
void testJob_withMockedResourceStream() throws Exception {
    // Prépare le flux simulé (faux contenu EBCDIC)
    byte[] fakeBytes = new byte[] { (byte) 0xC1, (byte) 0xC2, (byte) 0xC3 };
    ByteArrayInputStream fakeStream = new ByteArrayInputStream(fakeBytes);

    // Arrange les mocks de la chaîne
    Mockito.when(mftFileResourceBuilder
        .mftClient(Mockito.any()))
        .thenReturn(mftFileResourceBuilder); // chainage

    Mockito.when(mftFileResourceBuilder
        .nomConfiguration(Mockito.anyString()))
        .thenReturn(mftFileResourceBuilder);

    Mockito.when(mftFileResourceBuilder
        .nomFichier(Mockito.anyString()))
        .thenReturn(mftFileResourceBuilder);

    Mockito.when(mftFileResourceBuilder
        .build())
        .thenReturn(mftFileResource);

    Mockito.when(mftFileResource
        .getInputStream())
        .thenReturn(fakeStream);

    // Puis tu lances le job comme dans tes tests précédents !
    this.jobLauncherTestUtils.setJob(this.job);
    JobParameters params = new JobParametersBuilder()
            .addString("job.fichier.nom.lecture", "dummy.txt")
            .toJobParameters();
    JobExecution execution = this.jobLauncherTestUtils.launchJob(params);

    Assertions.assertNotNull(execution);
    Assertions.assertEquals(BatchStatus.COMPLETED, execution.getStatus());
}

 @Test
    void testCleanupFichierConvertiTasklet_suppressionOK() throws Exception {
        // Création d'un fichier temporaire à supprimer
        Path tempFile = Files.createTempFile("test_cleanup_", ".txt");
        String fichierConverti = tempFile.toAbsolutePath().toString();

        var tasklet = new BatchFluxPremierJourChargementConfiguration()
            .cleanupFichierConvertiTasklet(fichierConverti);

        // chunkContext peut être null pour ce test
        var status = tasklet.execute(null, null);

        assertFalse(Files.exists(tempFile), "Le fichier doit être supprimé");
        assertEquals(RepeatStatus.FINISHED, status);
    }

    @Test
void testCleanupFichierConvertiTasklet_fichierAbsent() throws Exception {
    String fichierConverti = "/tmp/fichier_qui_nexiste_pas.txt";
    var tasklet = new BatchFluxPremierJourChargementConfiguration()
        .cleanupFichierConvertiTasklet(fichierConverti);

    var status = tasklet.execute(null, null);
    assertEquals(RepeatStatus.FINISHED, status);
}

@Test
void testCleanupFichierConvertiTasklet_paramVide() throws Exception {
    String fichierConverti = "";
    var tasklet = new BatchFluxPremierJourChargementConfiguration()
        .cleanupFichierConvertiTasklet(fichierConverti);

    var status = tasklet.execute(null, null);
    assertEquals(RepeatStatus.FINISHED, status);
}

@Test
    void testLectureFluxPremierJourChargement_withMockedLineMapper() throws Exception {
        // Arrange : fichier ASCII temporaire
        Path fichier = Files.createTempFile("test_", ".txt");
        Files.writeString(fichier, "ligneTest1\nligneTest2\n");
        
        // Mock du lineMapper
        RubanSicModelLineMapper lineMapper = mock(RubanSicModelLineMapper.class);
        RubanSicDto dto1 = new RubanSicDto();
        when(lineMapper.mapLine(anyString(), anyInt())).thenReturn(dto1);
        
        // Ici, tu instancies ta config ou appelles la méthode statique/bean
        BatchFluxPremierJourChargementConfiguration config = new BatchFluxPremierJourChargementConfiguration();
        FlatFileItemReader<RubanSicDto> reader = config.lectureFluxPremierJourChargement(
                fichier.toString(),
                mock(MFTClient.class),
                lineMapper
        );
        
        // Act & Assert
        reader.open(new ExecutionContext());
        assertSame(dto1, reader.read());
        assertSame(dto1, reader.read()); // Toujours le mock ici
        reader.close();
    }

}
