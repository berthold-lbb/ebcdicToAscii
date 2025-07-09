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
    private final BufferedInputStream bis;
    private boolean headerSkipped = false;
    private boolean footerReached = false;

    public EbcdicRubanSicDtoReader(InputStream inputStream) {
        this.bis = new BufferedInputStream(inputStream);
    }

    @Override
    public RubanSicDto read() throws Exception {
        // 1. Skip entête
        if (!headerSkipped) {
            byte[] header = new byte[10];
            int readHeader = bis.read(header);
            headerSkipped = true;
            // Si tu veux traiter l'en-tête, tu peux ici
            if (readHeader < 10) return null;
        }

        // 2. Corps : lecture par bloc
        byte[] buffer = new byte[1390];
        int read = bis.read(buffer);
        if (read == -1 || read < 1390) {
            // 3. Lire et ignorer le pied de page (optionnel)
            if (!footerReached) {
                byte[] footer = new byte[10];
                bis.read(footer);
                footerReached = true;
            }
            return null; // EOF
        }

        // 4. Conversion custom EBCDIC → ASCII via ta logique
        String ligneDecodee = PlcConvertUtil.plcconvert(buffer);
        // 5. Mapping vers DTO
        RubanSicDto dto = RubanSicMapper.map(ligneDecodee);
        return dto;
    }
}
