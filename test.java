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
