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

}
