@Bean("beanLectureFluxPremierJourChargement")
@StepScope
public EbcdicRubanSicDtoReader lectureFluxPremierJourChargement(
    @Value("#{jobParameters['job.fichier.nom.lecture']}") String nomFichier,
    MFTClient mftClient
) throws IOException {
    Resource resource = new MftFileResourceBuilder()
        .mftClient(mftClient)
        .nomConfiguration("flux_premier_jour_lecture")
        .nomFichier(nomFichier)
        .build();

    InputStream inputStream = resource.getInputStream();
    return new EbcdicRubanSicDtoReader(inputStream);
}




import org.springframework.batch.item.ItemReader;
import java.io.*;

public class EbcdicRubanSicDtoReader implements ItemReader<RubanSicDto> {
    private final DataInputStream binaryReader;
    private boolean enteteLue = false;
    private boolean piedDePageLue = false;
    // stocke temporairement les DTO à retourner ligne à ligne
    private Queue<RubanSicDto> buffer = new LinkedList<>();

    public EbcdicRubanSicDtoReader(InputStream is) {
        this.binaryReader = new DataInputStream(new BufferedInputStream(is));
    }

    @Override
    public RubanSicDto read() throws Exception {
        if (!enteteLue) {
            // ----------- LIRE ENTETE -----------
            byte[] enteteBytes = new byte[10];
            lireProchaineLigne(binaryReader, enteteBytes, (byte)10, 10);
            String header = conversionEBCDIC2Ascii(enteteBytes, true);
            RubanSicDto dto = RubanSicModelLineMapper.mapLine(header.trim());
            enteteLue = true;
            return dto; // Retourne l’entête d’abord
        }

        // ---------- LIRE CORPS -----------
        if (binaryReader.available() >= 1390) {
            byte[] ligneBytes = new byte[1390];
            lireProchaineLigne(binaryReader, ligneBytes, (byte)10, 1390);
            // Ici tu fais ta logique de découpe champ à champ comme dans ton code
            // ... (découpe chaque champ, conversion packed, etc.)
            String corpsDecodé = ...; // Construit à partir des champs décodés
            RubanSicDto dto = RubanSicModelLineMapper.mapLine(corpsDecodé);
            return dto;
        }

        // ----------- LIRE PIED DE PAGE (si pas encore fait) -----------
        if (!piedDePageLue && binaryReader.available() > 0) {
            byte[] piedBytes = new byte[10];
            lireProchaineLigne(binaryReader, piedBytes, (byte)10, 10);
            String footer = conversionEBCDIC2Ascii(piedBytes, true);
            RubanSicDto dto = RubanSicModelLineMapper.mapLine(footer.trim());
            piedDePageLue = true;
            return dto;
        }

        // ----------- FIN DU FICHIER -----------
        return null;
    }
}



public static int lireProchaineLigne(DataInputStream br, byte[] bDstArray, byte bChar, int intExpectedMinimumLength) throws IOException {
    int num = 0;
    int b2;
    while (num < intExpectedMinimumLength) {
        b2 = br.read();
        if (b2 == -1) {
            // Fin de fichier
            break;
        }
        if ((byte) b2 == bChar) {
            // Caractère de fin de ligne atteint (optionnel, selon ton format)
            break;
        }
        bDstArray[num++] = (byte) b2;
    }
    // Si tu veux remplir le reste du buffer par des zéros si fin de flux prématurée :
    while (num < intExpectedMinimumLength) {
        bDstArray[num++] = 0;
    }
    return num;
}






@Override
public RubanSicDto read() throws Exception {
    // Lire l'en-tête (une seule fois)
    if (!enteteLue) {
        byte[] headerBytes = new byte[10];
        int lus = lireProchaineLigne(binaryReader, headerBytes, (byte) 10, 10);
        if (lus < 1) return null; // Fin du fichier prématurée
        String header = conversionEBCDIC2Ascii(headerBytes, true);
        enteteLue = true;
        return rubanSicModelLineMapper.mapLine(header.trim());
    }

    // Lire le corps du fichier (enregistrements de 1390 bytes)
    byte[] corpsBytes = new byte[1390];
    int lus = lireProchaineLigne(binaryReader, corpsBytes, (byte) 10, 1390);
    if (lus < 1) {
        // Fin de fichier (plus rien à lire)
        return null;
    } else if (lus < 1390) {
        // Ici, tu peux décider que c'est le pied de page ou ignorer
        piedDePageLue = true;
        String footer = conversionEBCDIC2Ascii(Arrays.copyOf(corpsBytes, lus), true);
        return rubanSicModelLineMapper.mapLine(footer.trim());
    }

    // ----- Logique de découpage champ à champ (comme dans ton batch d'origine) -----
    // Les tableaux pour chaque champ
    byte[] array2 = Arrays.copyOfRange(corpsBytes, 0, 233);
    byte[] array3 = Arrays.copyOfRange(corpsBytes, 233, 242);
    byte[] array4 = Arrays.copyOfRange(corpsBytes, 242, 1398);
    byte[] array5 = Arrays.copyOfRange(corpsBytes, 1398, 1401);
    byte[] array6 = Arrays.copyOfRange(corpsBytes, 1401, 1404);
    byte[] array7 = Arrays.copyOfRange(corpsBytes, 1404, 1407);
    byte[] array8 = Arrays.copyOfRange(corpsBytes, 1407, 1410);
    byte[] array9 = Arrays.copyOfRange(corpsBytes, 1410, 1412);
    // ...etc pour les autres champs...

    int num = 0;
    try {
        num = Integer.parseInt(conversionPackedToAscii(array9, 0));
    } catch (Exception e) {
        num = 0;
    }

    char paddingChar = '0';
    StringBuilder sb = new StringBuilder();
    sb.append(conversionEBCDIC2Ascii(array2, true));
    sb.append(padLeft(conversionPackedToAscii(array7, 0), 5, paddingChar));
    sb.append(padLeft(conversionPackedToAscii(array8, 0), 2, paddingChar));
    sb.append(conversionEBCDIC2Ascii(array3, false));
    sb.append(conversionEBCDIC2Ascii(array4, true));
    sb.append(padLeft(conversionPackedToAscii(array5, 0), 5, paddingChar));
    sb.append(padLeft(conversionPackedToAscii(array6, 0), 5, paddingChar));
    // ... Ajoute les autres champs nécessaires selon ta logique

    // Pour les champs répétés, adapte ici si besoin (selon ta structure d'origine)

    // Mapping final de la ligne décodée
    return rubanSicModelLineMapper.mapLine(sb.toString());
}



public class EbcdicRawReader implements ItemReader<byte[]>, ItemStream {

    private DataInputStream dis;
    private boolean headerRead = false;
    private boolean footerRead = false;

    public EbcdicRawReader(File file) throws IOException {
        dis = new DataInputStream(new BufferedInputStream(new FileInputStream(file)));
    }

    @Override
    public byte[] read() throws Exception {
        if (!headerRead) {
            byte[] header = new byte[10];
            int lus = dis.read(header);
            if (lus < 10) return null; // erreur ou EOF
            headerRead = true;
            return header;
        }

        byte[] corps = new byte[1390];
        int lus = dis.read(corps);
        
        if (lus == 1390) {
            return corps;
        } else if (!footerRead && lus > 0) {
            // probablement pied de page
            footerRead = true;
            return Arrays.copyOf(corps, lus);
        }
        
        return null; // fin du fichier
    }

    @Override public void open(ExecutionContext ctx) {}
    @Override public void update(ExecutionContext ctx) {}
    @Override public void close() throws IOException { dis.close(); }
}



public class EbcdicProcessor implements ItemProcessor<byte[], RubanSicDto> {

    private boolean headerProcessed = false;
    private boolean footerProcessed = false;

    @Override
    public RubanSicDto process(byte[] bloc) throws Exception {
        String ligne;
        
        if (!headerProcessed) {
            ligne = conversionEBCDICToAscii(bloc, true);
            headerProcessed = true;
        } else if (bloc.length == 1390) {
            ligne = plcConvertCorps(bloc);  // Ta logique complexe actuelle
        } else if (!footerProcessed) {
            ligne = conversionEBCDICToAscii(bloc, true);
            footerProcessed = true;
        } else {
            return null;
        }

        return RubanSicModelLineMapper.mapLine(ligne);
    }

    private String plcConvertCorps(byte[] corps) {
        // Ton code actuel de plcConvert adapté sur corps (1390 octets)
        // retourne la ligne ASCII correspondante
        return "..."; // à compléter avec ta logique actuelle
    }
}


@Bean
public Step ebcdicStep(JobRepository jobRepository, PlatformTransactionManager tm,
                       EbcdicRawReader reader, EbcdicProcessor processor,
                       JdbcBatchItemWriter<RubanSicDto> writer) {
    return new StepBuilder("ebcdicStep", jobRepository)
        .<byte[], RubanSicDto>chunk(1000, tm)
        .reader(reader)
        .processor(processor)
        .writer(writer)
        .build();
}



















@Component
public class EbcdicProcessor implements ItemProcessor<byte[], RubanSicDto> {

    private final RubanSicModelLineMapper lineMapper;
    private boolean headerProcessed = false;
    private boolean footerProcessed = false;
    private final char paddingChar = '0';

    public EbcdicProcessor(RubanSicModelLineMapper lineMapper) {
        this.lineMapper = lineMapper;
    }

    @Override
    public RubanSicDto process(byte[] bloc) throws Exception {
        String ligne;

        if (!headerProcessed && bloc.length == 10) {
            ligne = conversionEBCDICToAscii(bloc, true);
            headerProcessed = true;
        } else if (bloc.length == 1390) {
            ligne = plcConvertCorps(bloc); // Ta logique complexe
        } else if (!footerProcessed && bloc.length == 10) {
            ligne = conversionEBCDICToAscii(bloc, true);  // Pied de page
            footerProcessed = true;
        } else {
            return null;  // cas non prévu
        }

        return lineMapper.mapLine(ligne);
    }

    private String plcConvertCorps(byte[] bloc) throws Exception {
        // Remplacer 'array' par 'bloc' directement car bloc.length == 1390
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

        // Découpage initial
        verifierChamp(deplacerByteArray(bloc, 0, array2), array2.length);
        verifierChamp(deplacerByteArray(bloc, 233, array3), array3.length);
        verifierChamp(deplacerByteArray(bloc, 242, array4), array4.length);
        verifierChamp(deplacerByteArray(bloc, 1398, array5), array5.length);
        verifierChamp(deplacerByteArray(bloc, 1401, array6), array6.length);
        verifierChamp(deplacerByteArray(bloc, 1404, array7), array7.length);
        verifierChamp(deplacerByteArray(bloc, 1407, array8), array8.length);
        verifierChamp(deplacerByteArray(bloc, 1410, array9), array9.length);

        int num = Integer.parseInt(conversionPackedToAscii(array9, 0));

        // Construction texte décodé
        StringBuilder text = new StringBuilder();
        text.append(conversionEBCDICToAscii(array2, true))
            .append(padLeft(conversionPackedToAscii(array7, 0), 5, paddingChar))
            .append(padLeft(conversionPackedToAscii(array8, 0), 2, paddingChar))
            .append(conversionEBCDICToAscii(array3, false))
            .append(conversionEBCDICToAscii(array4, true))
            .append(padLeft(conversionPackedToAscii(array5, 0), 5, paddingChar))
            .append(padLeft(conversionPackedToAscii(array6, 0), 5, paddingChar))
            .append(conversionEBCDICToAscii(array16, true));

        // Traitement des sous-champs
        for (int i = 0; i < num; i++) {
            int offset = 1448 + i * 4;
            verifierChamp(deplacerByteArray(bloc, offset, array10), array10.length);
            verifierChamp(deplacerByteArray(bloc, offset + 2, array11), array11.length);
            verifierChamp(deplacerByteArray(bloc, offset, array12), array12.length);
            verifierChamp(deplacerByteArray(bloc, offset + 10, array13), array13.length);
            verifierChamp(deplacerByteArray(bloc, offset + 20, array14), array14.length);
            verifierChamp(deplacerByteArray(bloc, offset + 23, array15), array15.length);
            verifierChamp(deplacerByteArray(bloc, offset + 26, array16), array16.length);

            text.append(padLeft(conversionPackedToAscii(array10, 0), 1, paddingChar))
                .append(padLeft(conversionPackedToAscii(array11, 0), 15, paddingChar))
                .append(conversionEBCDICToAscii(array12, false))
                .append(conversionEBCDICToAscii(array13, false))
                .append(conversionEBCDICToAscii(array14, false))
                .append(conversionEBCDICToAscii(array15, false))
                .append(padLeft(conversionPackedToAscii(array16, 0), 15, paddingChar));
        }

        return text.toString();
    }

    // ---- Méthodes utilitaires nécessaires ----
    
    private int deplacerByteArray(byte[] source, int offset, byte[] destination) {
        int length = Math.min(destination.length, source.length - offset);
        System.arraycopy(source, offset, destination, 0, length);
        return length;
    }

    private void verifierChamp(int tailleCopiee, int tailleAttendue) throws Exception {
        if (tailleCopiee < tailleAttendue) {
            throw new Exception("Erreur taille champ attendue : " + tailleAttendue + ", obtenue : " + tailleCopiee);
        }
    }

    private String padLeft(String input, int length, char padChar) {
        return String.format("%" + length + "s", input).replace(' ', padChar);
    }

    // Tes méthodes conversionEBCDICToAscii et conversionPackedToAscii restent inchangées
}





@Component
public class PlcConverterService {

    public List<String> convertirFichierComplet(File file) throws Exception {
        List<String> lignesConverties = new ArrayList<>();

        try (BufferedInputStream bis = new BufferedInputStream(new FileInputStream(file))) {
            byte[] buffer = new byte[20000]; // buffer général
            char paddingChar = '0';

            // Lire en-tête
            int lus = lireProchaineLigne(bis, buffer, (byte)10, 10);
            if (lus == 10) {
                lignesConverties.add(conversionEBCDICToAscii(Arrays.copyOf(buffer, 10), true).trim());
            }

            // Lire corps
            while (bis.available() >= 1390) {
                lus = lireProchaineLigne(bis, buffer, (byte)10, 1390);
                if (lus < 1390) break;

                // Ta logique actuelle complète ici :
                String ligne = appliquerLogiqueConversionCorps(buffer, paddingChar);
                lignesConverties.add(ligne);
            }

            // Lire pied de page
            lus = lireProchaineLigne(bis, buffer, (byte)10, 10);
            if (lus == 10) {
                lignesConverties.add(conversionEBCDICToAscii(Arrays.copyOf(buffer, 10), true).trim());
            }
        }

        return lignesConverties;
    }

    private String appliquerLogiqueConversionCorps(byte[] array, char paddingChar) throws Exception {
        byte[] array2 = new byte[233];
        byte[] array3 = new byte[9];
        byte[] array4 = new byte[1156];
        byte[] array5 = new byte[3];
        byte[] array6 = new byte[3];
        byte[] array7 = new byte[3];
        byte[] array8 = new byte[3];
        byte[] array9 = new byte[2];
        byte[] array16 = new byte[8];

        verifierChamp(deplacerByteArray(array, 0, array2), array2.length);
        verifierChamp(deplacerByteArray(array, 233, array3), array3.length);
        verifierChamp(deplacerByteArray(array, 242, array4), array4.length);
        verifierChamp(deplacerByteArray(array, 1398, array5), array5.length);
        verifierChamp(deplacerByteArray(array, 1401, array6), array6.length);
        verifierChamp(deplacerByteArray(array, 1404, array7), array7.length);
        verifierChamp(deplacerByteArray(array, 1407, array8), array8.length);
        verifierChamp(deplacerByteArray(array, 1410, array9), array9.length);

        String text = conversionEBCDICToAscii(array2, true)
            + padLeft(conversionPackedToAscii(array7, 0), 5, paddingChar)
            + padLeft(conversionPackedToAscii(array8, 0), 2, paddingChar)
            + conversionEBCDICToAscii(array3, false)
            + conversionEBCDICToAscii(array4, true)
            + padLeft(conversionPackedToAscii(array5, 0), 5, paddingChar)
            + padLeft(conversionPackedToAscii(array6, 0), 5, paddingChar)
            + conversionEBCDICToAscii(array16, true);

        // Tu peux aussi ajouter ta boucle interne ici si besoin (enfants)

        return text;
    }

    private int lireProchaineLigne(InputStream br, byte[] bDstArray, byte bChar, int len) throws IOException {
        int num = 0, b2;
        while (num < len && (b2 = br.read()) != -1 && (byte)b2 != bChar) {
            bDstArray[num++] = (byte)b2;
        }
        return num;
    }

    private int deplacerByteArray(byte[] src, int offset, byte[] dst) {
        int length = Math.min(dst.length, src.length - offset);
        System.arraycopy(src, offset, dst, 0, length);
        return length;
    }

    private void verifierChamp(int tailleCopiee, int tailleAttendue) throws Exception {
        if (tailleCopiee < tailleAttendue) {
            throw new Exception("Erreur taille champ attendue : " + tailleAttendue + ", obtenue : " + tailleCopiee);
        }
    }

    private String padLeft(String input, int length, char padChar) {
        return String.format("%" + length + "s", input).replace(' ', padChar);
    }

    // Tes méthodes conversionEBCDICToAscii et conversionPackedToAscii restent inchangées
}

