package com.antigravity.vinyltracker.service;

import com.antigravity.vinyltracker.model.discogs.DiscogsDto;
import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

@Service
public class PdfService {

    private final QrCodeService qrCodeService;

    public PdfService(QrCodeService qrCodeService) {
        this.qrCodeService = qrCodeService;
    }

    public byte[] generateQrCodePdf(List<DiscogsDto.QrCodeItem> items) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            Document document = new Document();
            PdfWriter.getInstance(document, out);

            document.open();

            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18);
            Paragraph title = new Paragraph("My Vinyl Collection QR Codes", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            title.setSpacingAfter(20);
            document.add(title);

            PdfPTable table = new PdfPTable(3); // 3 columns for grid layout
            table.setWidthPercentage(100);
            table.setSpacingBefore(10f);
            table.setSpacingAfter(10f);

            for (DiscogsDto.QrCodeItem item : items) {
                PdfPCell cell = createItemCell(item);
                table.addCell(cell);
            }

            // Fill remaining cells if last row is incomplete
            int remainder = items.size() % 3;
            if (remainder != 0) {
                for (int i = 0; i < (3 - remainder); i++) {
                    PdfPCell emptyCell = new PdfPCell();
                    emptyCell.setBorder(Rectangle.NO_BORDER);
                    table.addCell(emptyCell);
                }
            }

            document.add(table);
            document.close();

        } catch (DocumentException e) {
            throw new IOException("Error generating PDF", e);
        }

        return out.toByteArray();
    }

    private PdfPCell createItemCell(DiscogsDto.QrCodeItem item) throws IOException, BadElementException {
        PdfPCell cell = new PdfPCell();
        cell.setBorder(Rectangle.NO_BORDER);
        cell.setPadding(10);
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);

        // Title and Artist
        String artistName = item.getArtist() != null ? item.getArtist() : "Unknown Artist";

        Paragraph info = new Paragraph(
                item.getTitle() + "\n" + artistName,
                FontFactory.getFont(FontFactory.HELVETICA, 10));
        info.setAlignment(Element.ALIGN_CENTER);
        cell.addElement(info);

        // QR Code
        String qrContent = "discogs-id:" + item.getId();
        byte[] qrBytes = qrCodeService.generateQrCodeImage(qrContent, 150, 150);
        Image qrImage = Image.getInstance(qrBytes);
        qrImage.setAlignment(Element.ALIGN_CENTER);
        qrImage.scaleToFit(100, 100);
        cell.addElement(qrImage);

        // ID Label
        Paragraph idLabel = new Paragraph(
                "ID: " + item.getId(),
                FontFactory.getFont(FontFactory.HELVETICA, 8, Font.ITALIC));
        idLabel.setAlignment(Element.ALIGN_CENTER);
        cell.addElement(idLabel);

        return cell;
    }
}
