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
}
