import java.nio.ByteBuffer;
import java.nio.charset.*;

public class ConverterBedel {

    private static final Charset EBCDIC_CHARSET = Charset.forName("Cp037");

    public static String conversionEBCDIC2Ascii(byte[] ebcdicBytes, boolean imprimableSeulement) {
        // Remplacements manuels spécifiques comme en C#
        byte bQuestionMark = 111;
        byte bSquareBracket = (byte) 186;
        byte bWeird1 = 95;
        byte bCircumflex = (byte) 176;
        byte bPipe = 79;
        byte bBrokenBar = 106;

        if (contains(ebcdicBytes, bSquareBracket)) {
            ebcdicBytes = replace(ebcdicBytes, bSquareBracket, bQuestionMark);
        }
        if (contains(ebcdicBytes, bCircumflex) || contains(ebcdicBytes, bPipe)) {
            ebcdicBytes = replace(ebcdicBytes, new byte[]{bCircumflex, bPipe}, bQuestionMark);
        }
        if (contains(ebcdicBytes, bBrokenBar)) {
            ebcdicBytes = replace(ebcdicBytes, bBrokenBar, bPipe);
        }
        if (contains(ebcdicBytes, bWeird1)) {
            ebcdicBytes = replace(ebcdicBytes, bWeird1, bCircumflex);
        }

        // Décodage EBCDIC avec remplacement explicite des caractères invalides
        CharsetDecoder decoder = EBCDIC_CHARSET
                .newDecoder()
                .onMalformedInput(CodingErrorAction.REPLACE)
                .onUnmappableCharacter(CodingErrorAction.REPLACE)
                .replaceWith("?");  // ✅ Forcer comportement à la .NET

        String text;
        try {
            text = decoder.decode(ByteBuffer.wrap(ebcdicBytes)).toString();
        } catch (CharacterCodingException e) {
            throw new RuntimeException("Erreur lors de la conversion EBCDIC → ASCII", e);
        }

        // Nettoyage si on veut garder uniquement les imprimables ASCII
        if (imprimableSeulement) {
            text = text.replaceAll("[^\\u0020-\\u007E]", "?"); // Remplace tous les caractères non imprimables
        }

        return text;
    }

    // Méthodes utilitaires
    private static boolean contains(byte[] array, byte value) {
        for (byte b : array) {
            if (b == value) return true;
        }
        return false;
    }

    private static boolean contains(byte[] array, byte[] values) {
        for (byte b : array) {
            for (byte v : values) {
                if (b == v) return true;
            }
        }
        return false;
    }

    private static byte[] replace(byte[] array, byte toReplace, byte replacement) {
        byte[] result = new byte[array.length];
        for (int i = 0; i < array.length; i++) {
            result[i] = (array[i] == toReplace) ? replacement : array[i];
        }
        return result;
    }

    private static byte[] replace(byte[] array, byte[] toReplaceList, byte replacement) {
        byte[] result = new byte[array.length];
        for (int i = 0; i < array.length; i++) {
            boolean found = false;
            for (byte toReplace : toReplaceList) {
                if (array[i] == toReplace) {
                    found = true;
                    break;
                }
            }
            result[i] = found ? replacement : array[i];
        }
        return result;
    }
}
