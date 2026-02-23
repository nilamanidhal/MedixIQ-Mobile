import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Generates PDF Report
 * @param {Object} user - User object
 * @param {Array} medicines - List of medicines
 * @param {Array} logs - List of logs
 * @param {number} days - 7 or 30
 * @param {string} action - 'share' or 'download'
 */
export const generateDoctorReport = async (user, medicines, logs, days, action) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const today = new Date().toLocaleDateString();

  // --- 1. FILTER LOGS BY DATE ---
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const reportLogs = logs.filter(l => new Date(l.date) >= cutoffDate);

  // --- 2. HEADER SECTION ---
  doc.setFontSize(22);
  doc.setTextColor(37, 99, 235);
  doc.text("MedMind Report", 14, 20);

  // Patient Info Box
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 30, pageWidth - 28, 25, 'F');

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("PATIENT NAME:", 20, 40);
  doc.text("REPORT PERIOD:", 120, 40);

  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(user?.name || "N/A", 50, 40);
  doc.text(`Last ${days} Days`, 150, 40);

  // --- 3. SUMMARY STATS ---
  const totalLogs = reportLogs.length;
  const takenLogs = reportLogs.filter(l => l.status === 'taken').length;
  const score = totalLogs > 0 ? Math.round((takenLogs / totalLogs) * 100) : 0;

  doc.setFontSize(14);
  doc.text(`${days}-Day Overview`, 14, 70);
  doc.setLineWidth(0.5);
  doc.setDrawColor(37, 99, 235);
  doc.line(14, 73, 50, 73);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Adherence Score: ${score}%`, 14, 82);
  doc.text(`Doses Taken: ${takenLogs}/${totalLogs}`, 14, 88);

  // --- 4. ACTIVE MEDICATIONS TABLE ---
  const activeMedsData = medicines
    .filter(m => m.isActive && !m.isPaused)
    .map(m => [m.name, m.dose, m.times.join(", ")]);

  autoTable(doc, {
    startY: 100,
    head: [['Medicine', 'Dose', 'Times']],
    body: activeMedsData,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] },
  });

  // --- 5. HISTORY LOGS TABLE ---
  const finalY = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.text("Detailed History", 14, finalY);

  const historyData = reportLogs.map(log => [
    new Date(log.date).toLocaleDateString() + " " + log.time,
    log.medicineId?.name || "Unknown",
    log.status.toUpperCase()
  ]);

  autoTable(doc, {
    startY: finalY + 5,
    head: [['Date/Time', 'Medicine', 'Status']],
    body: historyData,
    theme: 'striped',
    headStyles: { fillColor: [100, 116, 139] },
    didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 2) {
            if (data.cell.raw === 'MISSED') data.cell.styles.textColor = [220, 38, 38];
            if (data.cell.raw === 'TAKEN') data.cell.styles.textColor = [22, 163, 74];
        }
    }
  });

  // --- 6. SAVE OR SHARE ---
  try {
    const base64Data = doc.output('datauristring').split(',')[1];
    const safeName = (user?.name || 'Patient').replace(/[^a-z0-9]/gi, '_');
    const fileName = `MedMind_Report_${days}Days_${safeName}_${Date.now()}.pdf`;

    if (action === 'share') {
        // SHARE: Write to Cache (Temp) then Share
        const result = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache
        });

        await Share.share({
            title: 'MedMind Report',
            text: `Medication report for ${user?.name} (${days} days).`,
            url: result.uri,
            dialogTitle: 'Send Report PDF'
        });

        return { success: true, message: "Shared successfully" };

    } else {
        // DOWNLOAD: Write to Documents (Permanent)
        const result = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Documents
        });
        
        return { success: true, message: `Saved to Documents as ${fileName}` };
    }

  } catch (error) {
    console.error("PDF Error:", error);
    // Web Fallback
    if (!window.Capacitor) {
       doc.save(`MedMind_Report.pdf`);
       return { success: true, message: "Downloaded (Web)" };
    }
    throw error;
  }
};


/**
 * Generates Emergency Wallet Card PDF (Credit Card Size)
 * @param {Object} profileData - Emergency Profile Data
 * @param {String} token - Emergency Token
 */
export const generateWalletCardPDF = async (profileData, token) => {
    // Standard credit card size: 85.6mm x 53.98mm (Landscape)
    const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [85.6, 53.98]
    });

    // 1. Background & Header
    doc.setFillColor(220, 38, 38); // Red header
    doc.rect(0, 0, 85.6, 12, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("EMERGENCY MEDICAL ID", 42.8, 8, { align: "center" });

    // 2. Patient Data (Left Side)
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(profileData?.name?.toUpperCase() || "UNKNOWN", 5, 20);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Blood Group: `, 5, 26);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38); // Red for blood group
    doc.text(profileData?.bloodGroup || "N/A", 25, 26);

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    if (profileData?.allergies?.length > 0) {
        doc.text(`Allergies: ${profileData.allergies.join(', ').substring(0, 25)}`, 5, 32);
    }

    // Emergency Contact
    if (profileData?.emergencyContacts?.length > 0) {
        const ec = profileData.emergencyContacts[0];
        doc.setFont("helvetica", "bold");
        doc.text(`ICE: ${ec.phone}`, 5, 42);
        doc.setFont("helvetica", "normal");
        doc.text(`(${ec.name})`, 5, 46);
    }

    // 3. QR Code (Right Side)
    // Grab the QR code from the DOM canvas (rendered by react-qr-code)
    const qrSvg = document.getElementById("emergency-qr-code");
    if (qrSvg) {
        try {
            const svgData = new XMLSerializer().serializeToString(qrSvg);
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const img = new Image();
            
            await new Promise((resolve, reject) => {
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.fillStyle = "white"; 
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                    
                    const pngUrl = canvas.toDataURL("image/png");
                    doc.addImage(pngUrl, 'PNG', 55, 15, 28, 28);
                    resolve();
                };
                img.onerror = reject;
                img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
            });
        } catch (e) {
            console.error("Failed to render QR to PDF", e);
        }
    }

    // Footer Text
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text("Scan QR code for full medical profile & active medications.", 42.8, 50, { align: "center" });

    // Save or Share via Capacitor Filesystem (matching your existing logic)
    try {
        const base64Data = doc.output('datauristring').split(',')[1];
        const safeName = (profileData?.name || 'Patient').replace(/[^a-z0-9]/gi, '_');
        const fileName = `Emergency_Card_${safeName}.pdf`;

        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
             // Share directly on mobile
             const result = await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Cache
            });
            await Share.share({
                title: 'Emergency Medical Card',
                text: 'Print this card and keep it in your wallet.',
                url: result.uri,
                dialogTitle: 'Save Wallet Card'
            });
        } else {
            // Web Download
            doc.save(fileName);
        }
    } catch (error) {
        console.error("PDF Save Error:", error);
        doc.save(`Emergency_Card.pdf`); // Fallback web download
    }
};