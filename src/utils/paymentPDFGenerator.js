import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export const generatePaymentReceiptPDF = (paymentData, outputPath) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const writeStream = fs.createWriteStream(outputPath);
            
            doc.pipe(writeStream);

            // Header
            doc.fontSize(20)
               .font('Helvetica-Bold')
               .fillColor('#22c55e')
               .text('MESSFINDER', 50, 50)
               .fillColor('#000000')
               .fontSize(10)
               .text('Payment Receipt', 50, 75);

            // Receipt Title
            doc.fontSize(16)
               .font('Helvetica-Bold')
               .text('PAYMENT RECEIPT', 50, 110);

            // Green line
            doc.moveTo(50, 130)
               .lineTo(550, 130)
               .strokeColor('#22c55e')
               .lineWidth(2)
               .stroke();

            // Payment Details
            let yPosition = 160;

            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text('Transaction Details:', 50, yPosition);
            
            yPosition += 25;

            const details = [
                { label: 'Receipt No:', value: paymentData.transactionId },
                { label: 'Payment Date:', value: new Date(paymentData.paymentDate).toLocaleString() },
                { label: 'Customer Name:', value: paymentData.userName },
                { label: 'Customer Email:', value: paymentData.customerEmail || paymentData.userEmail },
                { label: 'Payment Method:', value: paymentData.paymentMethod.toUpperCase() },
                { label: 'Mess Name:', value: paymentData.messName },
                { label: 'Booking ID:', value: paymentData.bookingId },
            ];

            details.forEach(detail => {
                doc.font('Helvetica-Bold')
                   .text(detail.label, 50, yPosition)
                   .font('Helvetica')
                   .text(detail.value, 150, yPosition);
                yPosition += 20;
            });

            yPosition += 10;

            // Amount Box
            doc.rect(50, yPosition, 500, 60)
               .fillColor('#f0fdf4')
               .fill()
               .strokeColor('#22c55e')
               .stroke();

            doc.fontSize(20)
               .font('Helvetica-Bold')
               .fillColor('#16a34a')
               .text(`BDT ${paymentData.amount}`, 50, yPosition + 20)
               .fontSize(12)
               .fillColor('#000000')
               .text('Total Amount Paid', 50, yPosition + 45);

            yPosition += 80;

            // Booking Details
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text('Booking Information:', 50, yPosition);
            
            yPosition += 25;

            const bookingDetails = [
                { label: 'Check-in Date:', value: new Date(paymentData.checkInDate).toLocaleDateString() },
                { label: 'Advance Months:', value: `${paymentData.advanceMonths} month(s)` },
                { label: 'Monthly Rent:', value: `BDT ${paymentData.monthlyRent}` },
            ];

            if (paymentData.roomType) {
                bookingDetails.push({ label: 'Room Type:', value: paymentData.roomType });
            }

            bookingDetails.forEach(detail => {
                doc.font('Helvetica-Bold')
                   .text(detail.label, 50, yPosition)
                   .font('Helvetica')
                   .text(detail.value, 150, yPosition);
                yPosition += 20;
            });

            yPosition += 20;

            // Footer
            doc.fontSize(10)
               .fillColor('#666666')
               .text('Thank you for choosing MessFinder!', 50, yPosition)
               .text('This is an computer-generated receipt. No signature required.', 50, yPosition + 15)
               .text(`Generated on: ${new Date().toLocaleString()}`, 50, yPosition + 30);

            // Finalize the PDF
            doc.end();

            writeStream.on('finish', () => {
                //console.log('PDF generated successfully:', outputPath);
                resolve(outputPath);
            });

            writeStream.on('error', (error) => {
                reject(error);
            });

        } catch (error) {
            reject(error);
        }
    });
};

// Helper function to ensure directory exists
const ensureDirectoryExists = (filePath) => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};