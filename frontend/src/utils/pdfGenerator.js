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