
import java.io.*;
import java.nio.charset.Charset;
import java.util.Arrays;

public class EbcdicOutils {

    public static void main(String[] args) {
        String inputPath = "input.ebc";
        String outputPath = "output.txt";

        boolean result = plcConvert(inputPath, outputPath);
        if (result) {
            System.out.println("Conversion réussie.");
        } else {
            System.out.println("Échec de la conversion.");
        }
    }

    public static boolean plcConvert(String inputFile, String outputFile) {
        byte[] array = new byte[20000];
        byte[] array2 = new byte[233];
        byte[] array3 = new byte[9];
        byte[] array4 = new byte[1156];
        byte[] array5 = new byte[3];
        byte[] array6 = new byte[3];
        byte[] array7 = new byte[3];
        byte[] array8 = new byte[3];
        byte[] array9 = new byte[2];
        byte[] array10 = new byte[3];
        byte[] array11 = new byte[3];
        byte[] array12 = new byte[100];
        byte[] array13 = new byte[100];
        byte[] array14 = new byte[3];
        byte[] array15 = new byte[3];
        byte[] array16 = new byte[8];

        char paddingChar = '0';
        int num;

        try (FileInputStream fis = new FileInputStream(inputFile);
             BufferedInputStream bis = new BufferedInputStream(fis);
             FileWriter fw = new FileWriter(outputFile);
             BufferedWriter bw = new BufferedWriter(fw)) {

            // Lire et ignorer l'en-tête
            int num2 = lireProchaineLigne(bis, array, (byte) 10, 10);
            if (num2 > 0) {
                String text = conversionEBCDICToAscii(array, true);
                bw.write(text.trim());
                bw.newLine();
            }

            // Lire les lignes intermédiaires
            while (bis.available() >= 1390) {
                Arrays.fill(array, (byte) 0);
                String text = null;

                num2 = lireProchaineLigne(bis, array, (byte) 10, 1390);

                verifierChamp(deplacerByteArray(array, 0, array2), array2.length, bis);
                verifierChamp(deplacerByteArray(array, 233, array3), array3.length, bis);
                verifierChamp(deplacerByteArray(array, 242, array4), array4.length, bis);
                verifierChamp(deplacerByteArray(array, 1398, array5), array5.length, bis);
                verifierChamp(deplacerByteArray(array, 1401, array6), array6.length, bis);
                verifierChamp(deplacerByteArray(array, 1404, array7), array7.length, bis);
                verifierChamp(deplacerByteArray(array, 1407, array8), array8.length, bis);
                verifierChamp(deplacerByteArray(array, 1410, array9), array9.length, bis);
                verifierChamp(deplacerByteArray(array, 1422, array10), array10.length, bis);
                verifierChamp(deplacerByteArray(array, 1424, array11), array11.length, bis);
                verifierChamp(deplacerByteArray(array, 1422, array12), array12.length, bis);
                verifierChamp(deplacerByteArray(array, 1432, array13), array13.length, bis);
                verifierChamp(deplacerByteArray(array, 1442, array14), array14.length, bis);
                verifierChamp(deplacerByteArray(array, 1445, array15), array15.length, bis);
                verifierChamp(deplacerByteArray(array, 1448, array16), array16.length, bis);

                num = Integer.parseInt(conversionPackedToAscii(array9, 0));

                text = conversionEBCDICToAscii(array2, true);
                text += padLeft(conversionPackedToAscii(array7, 0), 5, paddingChar);
                text += padLeft(conversionPackedToAscii(array8, 0), 2, paddingChar);
                text += conversionEBCDICToAscii(array3, false);
                text += conversionEBCDICToAscii(array4, true);
                text += padLeft(conversionPackedToAscii(array5, 0), 5, paddingChar);
                text += padLeft(conversionPackedToAscii(array6, 0), 5, paddingChar);
                text += conversionEBCDICToAscii(array16, true);

                for (int i = 0; i < num; i++) {
                    int offset = 1448 + i * 4;
                    verifierChamp(deplacerByteArray(array, offset, array10), array10.length, bis);
                    verifierChamp(deplacerByteArray(array, offset + 2, array11), array11.length, bis);
                    verifierChamp(deplacerByteArray(array, offset, array12), array12.length, bis);
                    verifierChamp(deplacerByteArray(array, offset + 10, array13), array13.length, bis);
                    verifierChamp(deplacerByteArray(array, offset + 20, array14), array14.length, bis);
                    verifierChamp(deplacerByteArray(array, offset + 23, array15), array15.length, bis);
                    verifierChamp(deplacerByteArray(array, offset + 26, array16), array16.length, bis);

                    text += padLeft(conversionPackedToAscii(array10, 0), 3, paddingChar);
                    text += padLeft(conversionPackedToAscii(array11, 0), 15, paddingChar);
                    text += conversionEBCDICToAscii(array12, false);
                    text += conversionEBCDICToAscii(array13, false);
                    text += conversionEBCDICToAscii(array14, false);
                    text += conversionEBCDICToAscii(array15, false);
                    text += padLeft(conversionPackedToAscii(array16, 0), 15, paddingChar);
                }

                bw.write(text);
                bw.newLine();
            }

            // Lire et ignorer le pied de page
            Arrays.fill(array, (byte) 0);
            num2 = lireProchaineLigne(bis, array, (byte) 10, 10);
            if (num2 > 0) {
                String text3 = conversionEBCDICToAscii(array, true);
                bw.write(text3.trim());
                bw.newLine();
            }

        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
        return true;
    }

    public static boolean plcConvert2(String inputFile, String outputFile) {
        byte[] array = new byte[20000];
        byte[] array2 = new byte[233];
        byte[] array3 = new byte[9];
        byte[] array4 = new byte[1156];
        byte[] array5 = new byte[3];
        byte[] array6 = new byte[3];
        byte[] array7 = new byte[3];
        byte[] array8 = new byte[3];
        byte[] array9 = new byte[2];
        byte[] array10 = new byte[3];
        byte[] array11 = new byte[3];
        byte[] array12 = new byte[100];
        byte[] array13 = new byte[100];
        byte[] array14 = new byte[3];
        byte[] array15 = new byte[3];
        byte[] array16 = new byte[8];

        char paddingChar = '0';

        try (FileInputStream fis = new FileInputStream(inputFile);
            BufferedInputStream bis = new BufferedInputStream(fis);
            BufferedWriter bw = new BufferedWriter(new FileWriter(outputFile))) {

            int num2 = lireProchaineLigne(bis, array, (byte)10, 10);
            String text = conversionEBCDICToAscii(array, true).trim();
            bw.write(text);
            bw.newLine();

            while (bis.available() >= 1390) {
                Arrays.fill(array, (byte) 0);

                num2 = lireProchaineLigne(bis, array, (byte)10, 1390);

                deplacerByteArray(array, 0, array2);
                deplacerByteArray(array, 233, array3);
                deplacerByteArray(array, 242, array4);
                deplacerByteArray(array, 1398, array5);
                deplacerByteArray(array, 1401, array6);
                deplacerByteArray(array, 1404, array7);
                deplacerByteArray(array, 1407, array8);
                deplacerByteArray(array, 1410, array9);

                int num = 0;
                try {
                    num = Integer.parseInt(conversionPackedToAscii(array9, 0));
                } catch (Exception e) {
                    num = 0;
                }

                StringBuilder textBuilder = new StringBuilder();
                textBuilder.append(conversionEBCDICToAscii(array2, true));
                textBuilder.append(conversionEBCDICToAscii(array3, false));
                textBuilder.append(conversionEBCDICToAscii(array4, true));
                textBuilder.append(padLeft(conversionPackedToAscii(array5, 0), 5, paddingChar));
                textBuilder.append(padLeft(conversionPackedToAscii(array6, 0), 5, paddingChar));
                textBuilder.append(padLeft(conversionPackedToAscii(array7, 0), 5, paddingChar));
                textBuilder.append(padLeft(conversionPackedToAscii(array8, 0), 5, paddingChar));
                textBuilder.append(conversionEBCDICToAscii(array9, true));
                textBuilder.append(padLeft(conversionPackedToAscii(array9, 0), 2, paddingChar));

                for (int i = 0; i < num; i++) {
                    int offset = 1448 + i * 44;
                    deplacerByteArray(array, offset, array10);
                    deplacerByteArray(array, offset + 2, array11);
                    deplacerByteArray(array, offset + 4, array12);
                    deplacerByteArray(array, offset + 14, array13);
                    deplacerByteArray(array, offset + 24, array14);
                    deplacerByteArray(array, offset + 27, array15);
                    deplacerByteArray(array, offset + 30, array16);

                    textBuilder.append(padLeft(conversionPackedToAscii(array10, 0), 3, paddingChar));
                    textBuilder.append(padLeft(conversionPackedToAscii(array11, 0), 15, paddingChar));
                    textBuilder.append(conversionEBCDICToAscii(array12, false));
                    textBuilder.append(conversionEBCDICToAscii(array13, false));
                    textBuilder.append(conversionEBCDICToAscii(array14, false));
                    textBuilder.append(conversionEBCDICToAscii(array15, false));
                    textBuilder.append(padLeft(conversionPackedToAscii(array16, 0), 15, paddingChar));
                }

                bw.write(textBuilder.toString());
                bw.newLine();
            }

            Arrays.fill(array, (byte) 0);
            num2 = lireProchaineLigne(bis, array, (byte)10, 10);
            text = conversionEBCDICToAscii(array, true).trim();
            bw.write(text);
            bw.newLine();

        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }

        return true;
    }


    public static void verifierChamp(int tailleCopiee, int tailleAttendue, InputStream is) throws IOException {
        if (tailleCopiee < tailleAttendue && is.available() > 0) {
            throw new IOException("Longueur d’un champ invalide.");
        }
    }

    public static String conversionEBCDICToAscii(byte[] ebcdicBytes, boolean printableOnly) {
        if (ebcdicBytes == null) return "";

        byte QUESTION_MARK = (byte) 0x6D;
        byte SQUARE_BRACKET = (byte) 0xBA;
        byte WEIRD1 = (byte) 0x95;
        byte CIRCUMFLEX = (byte) 0xB0;
        byte PIPE = (byte) 0x79;
        byte BROKEN_BAR = (byte) 0x8C;

        // Remplacement sélectif comme dans le C#
        if (contains(ebcdicBytes, SQUARE_BRACKET)) {
            ebcdicBytes = replaceByte(ebcdicBytes, SQUARE_BRACKET, QUESTION_MARK);
        }
        if (contains(ebcdicBytes, CIRCUMFLEX) || contains(ebcdicBytes, PIPE)) {
            ebcdicBytes = replaceByte(ebcdicBytes, CIRCUMFLEX, QUESTION_MARK);
            ebcdicBytes = replaceByte(ebcdicBytes, PIPE, QUESTION_MARK);
        }
        if (contains(ebcdicBytes, BROKEN_BAR)) {
            ebcdicBytes = replaceByte(ebcdicBytes, BROKEN_BAR, PIPE);
        }
        if (contains(ebcdicBytes, WEIRD1)) {
            ebcdicBytes = replaceByte(ebcdicBytes, WEIRD1, CIRCUMFLEX);
        }

        Charset ebcdicCharset = Charset.forName("Cp037");
        String text = new String(ebcdicBytes, ebcdicCharset);

        if (printableOnly) {
            // Seuls les caractères imprimables ASCII
            text = text.replaceAll("[^\\x20-\\x7E]", "?");
        }

        return text;
    }

    private static boolean contains(byte[] array, byte target) {
        for (byte b : array) {
            if (b == target) return true;
        }
        return false;
    }

    private static byte[] replaceByte(byte[] array, byte from, byte to) {
        byte[] result = Arrays.copyOf(array, array.length);
        for (int i = 0; i < result.length; i++) {
            if (result[i] == from) result[i] = to;
        }
        return result;
    }

    public static String conversionEBCDICToAscii(byte[] ebcdicBytes, boolean printableOnly) {
        if (ebcdicBytes == null) return "";

        Charset ebcdicCharset = Charset.forName("Cp037");
        String text = new String(ebcdicBytes, ebcdicCharset);

        // Remplacements d'après la logique C#
        text = text.replace('[', '?');       // SQUARE_BRACKET
        text = text.replace('^', '?');       // CIRCUMFLEX
        text = text.replace('|', '?');       // PIPE
        text = text.replace('¬', '|');       // BROKEN_BAR
        text = text.replace('\u0095', '^');  // WEIRD1

        if (printableOnly) {
            text = text.replaceAll("[^\\x20-\\x7E]", "?");
        }

        return text;
    }


    public static String conversionEBCDICToAscii2(byte[] ebcdicBytes, boolean printableOnly) {
        String result = conversionEBCDICToAscii(ebcdicBytes, printableOnly);
        return result.replace("\n", "");
    }


    public static String conversionPackedToAscii(byte[] packed, int decimalPosition) {
        if (isAllFF(packed)) return "";
        StringBuilder digits = new StringBuilder();
        boolean isNegative = false;
        for (int i = 0; i < packed.length; i++) {
            int highNibble = (packed[i] >> 4) & 0x0F;
            int lowNibble = packed[i] & 0x0F;
            if (i == packed.length - 1) {
                if (lowNibble == 0x0D) isNegative = true;
                else if (lowNibble != 0x0C && lowNibble != 0x0F) return null;
                digits.append(highNibble);
            } else {
                digits.append(highNibble).append(lowNibble);
            }
        }
        if (decimalPosition > 0 && digits.length() > decimalPosition) {
            digits.insert(digits.length() - decimalPosition, '.');
        }
        if (isNegative) digits.insert(0, '-');
        return digits.toString();
    }

    public static boolean isAllFF(byte[] bytes) {
        if (bytes == null || bytes.length == 0) return false;
        for (byte b : bytes) {
            if ((b & 0xFF) != 0xFF) return false;
        }
        return true;
    }

    public static int deplacerByteArray(byte[] src, int offset, byte[] dest) {
        if (offset >= src.length) return -1;
        int len = Math.min(dest.length, src.length - offset);
        System.arraycopy(src, offset, dest, 0, len);
        return len;
    }

    public static int lireProchaineLigne(InputStream is, byte[] dstArray, byte delimiter, int minLength) throws IOException {
        int num = 0;
        int currentByte;
        while ((currentByte = is.read()) != -1) {
            dstArray[num++] = (byte) currentByte;
            if ((byte) currentByte == delimiter) {
                if (num >= minLength) break;
            }
        }
        return num == 0 ? -1 : num;
    }

    public static String padLeft(String input, int length, char padChar) {
        if (input == null) input = "";
        if (input.length() >= length) return input;
        StringBuilder sb = new StringBuilder();
        while (sb.length() < length - input.length()) {
            sb.append(padChar);
        }
        sb.append(input);
        return sb.toString();
    }
}
