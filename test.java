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

