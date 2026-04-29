import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Dialog } from '@capacitor/dialog';
import { Share } from '@capacitor/share'; 
import LoadingSpinner from '../LoadingSpinner';
import { 
    FileText, Plus, Trash2, Search, X, UploadCloud, 
    Camera as CameraIcon, Files, Download, Share2, 
    ChevronLeft, ChevronRight, Maximize2 
} from "lucide-react";
import { useTranslation } from 'react-i18next';

const MedicalRecords = () => {
    const { t } = useTranslation();
    const { token, API_BASE_URL } = useAuth();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Upload Modal State
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [newReport, setNewReport] = useState({ title: '', category: 'Prescription', images: [], previews: [] });

    //  VIEWER STATE (New)
    const [viewReport, setViewReport] = useState(null); // The report currently open
    const [activePageIndex, setActivePageIndex] = useState(0); // Which page we are looking at

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/reports`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setReports(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // --- CAMERA & UPLOAD LOGIC (Unchanged) ---
    const addPage = async () => {
        try {
            const image = await Camera.getPhoto({
                quality: 80,
                allowEditing: false,
                resultType: CameraResultType.Uri,
                source: CameraSource.Prompt 
            });
            const response = await fetch(image.webPath);
            const blob = await response.blob();
            const file = new File([blob], `page_${Date.now()}.jpg`, { type: "image/jpeg" });
            setNewReport(prev => ({ ...prev, images: [...prev.images, file], previews: [...prev.previews, image.webPath] }));
        } catch (error) {}
    };

    const removePage = (index) => {
        setNewReport(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index),
            previews: prev.previews.filter((_, i) => i !== index)
        }));
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (newReport.images.length === 0) return await Dialog.alert({ title: 'No Images', message: 'Add a page first.' });

        setUploading(true);
        const formData = new FormData();
        newReport.images.forEach((file) => formData.append('images', file));
        formData.append('title', newReport.title);
        formData.append('category', newReport.category);
        formData.append('date', new Date().toISOString());

        try {
            const res = await axios.post(`${API_BASE_URL}/reports`, formData, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
            setReports([res.data, ...reports]);
            setShowUploadModal(false);
            setNewReport({ title: '', category: 'Prescription', images: [], previews: [] });
        } catch (err) {
            await Dialog.alert({ title: 'Error', message: 'Upload failed.' });
        } finally {
            setUploading(false);
        }
    };

    // --- VIEWER ACTIONS ---
    const openViewer = (report) => {
        setViewReport(report);
        setActivePageIndex(0); // Reset to first page
    };

    const closeViewer = () => {
        setViewReport(null);
        setActivePageIndex(0);
    };

    const handleDownload = (url) => {
        // Simple way: Open in new browser tab so user can "Long Press > Save"
        window.open(url, '_blank');
    };

    const handleShare = async () => {
        if (!viewReport) return;
        const currentImageUrl = viewReport.pages[activePageIndex]?.imageUrl;
        try {
            await Share.share({
                title: viewReport.title,
                text: `Check out this medical record: ${viewReport.title}`,
                url: currentImageUrl,
                dialogTitle: 'Share Record',
            });
        } catch (error) {
            console.log("Share cancelled");
        }
    };

    const handleDelete = async (id) => {
        const { value } = await Dialog.confirm({
            title: 'Delete Record',
            message: 'Are you sure? This cannot be undone.',
            okButtonTitle: 'Delete',
            cancelButtonTitle: 'Cancel'
        });
        if (!value) return;

        try {
            await axios.delete(`${API_BASE_URL}/reports/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setReports(reports.filter(r => r._id !== id));
            if (viewReport?._id === id) closeViewer(); // Close modal if open
        } catch (err) {
            await Dialog.alert({ title: 'Error', message: 'Delete failed.' });
        }
    };

    const filteredReports = reports.filter(r => 
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <LoadingSpinner />;

    return (
        <div className="h-[100dvh] w-full overflow-y-auto bg-slate-50 pb-32 font-sans">
            
            {/* --- HEADER --- */}
            <div className="bg-white flex-shrink-0 px-6 pt-14 pb-4 sticky top-0 z-10 border-b border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('records.title')}</h1>
                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold">
                        {t('records.filesCount', {count: reports.length})}
                    </span>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder={t('records.search')} 
                        className="w-full bg-slate-100 pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* --- GRID LIST (Thumbnails) --- */}
            <div className="p-5 grid grid-cols-2 gap-4">
                {filteredReports.map(report => (
                    <div 
                        key={report._id} 
                        onClick={() => openViewer(report)} // 👈 OPEN VIEWER ON CLICK
                        className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex flex-col h-full active:scale-95 transition-transform cursor-pointer"
                    >
                        <div className="aspect-[4/5] bg-slate-100 rounded-xl overflow-hidden mb-3 relative group">
                            <img src={report.pages[0]?.imageUrl} alt="doc" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
                            {report.pages.length > 1 && (
                                <span className="absolute top-2 right-2 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center">
                                    <Files size={10} className="mr-1" /> {report.pages.length}
                                </span>
                            )}
                            <span className="absolute bottom-2 left-2 text-white text-[10px] font-medium bg-black/30 px-2 py-0.5 rounded-md backdrop-blur-sm">
                                {new Date(report.date).toLocaleDateString()}
                            </span>
                        </div>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm truncate w-24 leading-tight">{report.title}</h3>
                                <p className="text-[10px] text-slate-500 mt-0.5">{report.category}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {filteredReports.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                    <FileText size={48} className="text-slate-300 mb-2" />
                    <p className="text-slate-400 text-sm">{t('records.noRecords')}</p>
                </div>
            )}

            {/* FAB */}
            <button 
                onClick={() => setShowUploadModal(true)}
                className="fixed bottom-28 right-6 w-14 h-14 bg-blue-600 rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center text-white active:scale-90 transition-transform z-40"
            >
                <Plus size={28} />
            </button>

            {/* ========================================= */}
            {/*  FULL SCREEN VIEWER MODAL (LIGHTBOX) */}
            {/* ========================================= */}
            {viewReport && (
                <div className="fixed inset-0 z-[150] bg-black/95 flex flex-col animate-in fade-in duration-200">
                    
                    {/* Top Bar */}
                    <div className="flex justify-between items-center p-4 text-white bg-gradient-to-b from-black/50 to-transparent z-10">
                        <div>
                            <h2 className="font-bold text-lg">{viewReport.title}</h2>
                            <p className="text-xs text-slate-300">
                    {t('records.pageIndicator', { current: activePageIndex + 1, total: viewReport.pages.length })} • {new Date(viewReport.date).toLocaleDateString()}                            </p>
                        </div>
                        <button onClick={closeViewer} className="bg-white/10 p-2 rounded-full hover:bg-white/20">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Main Image Area (Zoomable/Scrollable) */}
                    <div className="flex-1 overflow-auto flex items-center justify-center relative p-2">
                        <img 
                            src={viewReport.pages[activePageIndex]?.imageUrl} 
                            alt="Full View" 
                            className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                        />
                        
                        {/* Navigation Arrows (Only if multiple pages) */}
                        {viewReport.pages.length > 1 && (
                            <>
                                {activePageIndex > 0 && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setActivePageIndex(p => p - 1); }}
                                        className="absolute left-4 bg-white/10 p-2 rounded-full text-white hover:bg-white/20"
                                    >
                                        <ChevronLeft size={32} />
                                    </button>
                                )}
                                {activePageIndex < viewReport.pages.length - 1 && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setActivePageIndex(p => p + 1); }}
                                        className="absolute right-4 bg-white/10 p-2 rounded-full text-white hover:bg-white/20"
                                    >
                                        <ChevronRight size={32} />
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    {/* Bottom Bar: Thumbnails & Actions */}
                    <div className="bg-slate-900/90 p-4 pb-8 space-y-4">
                        
                        {/* Thumbnail Strip (Only if multiple pages) */}
                        {viewReport.pages.length > 1 && (
                            <div className="flex space-x-2 overflow-x-auto justify-center py-2">
                                {viewReport.pages.map((page, idx) => (
                                    <div 
                                        key={idx}
                                        onClick={() => setActivePageIndex(idx)}
                                        className={`w-12 h-16 rounded-md overflow-hidden border-2 transition-all cursor-pointer ${
                                            activePageIndex === idx ? 'border-blue-500 opacity-100' : 'border-transparent opacity-50'
                                        }`}
                                    >
                                        <img src={page.imageUrl} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex justify-around items-center border-t border-white/10 pt-4">
                            <button onClick={() => handleDelete(viewReport._id)} className="flex flex-col items-center text-red-400 gap-1 active:scale-95">
                                <Trash2 size={20} />
                                <span className="text-[10px]">{t('common.delete')}</span>
                            </button>
                            
                            <button onClick={handleShare} className="flex flex-col items-center text-blue-400 gap-1 active:scale-95">
                                <Share2 size={20} />
                                <span className="text-[10px]">{t('records.share')}</span>
                            </button>
                            
                            <button 
                                onClick={() => handleDownload(viewReport.pages[activePageIndex]?.imageUrl)} 
                                className="flex flex-col items-center text-emerald-400 gap-1 active:scale-95"
                            >
                                <Download size={20} />
                                <span className="text-[10px]">{t('records.save')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- UPLOAD MODAL (Already Fixed) --- */}
            {showUploadModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-md mb-4 rounded-3xl p-6 animate-in slide-in-from-bottom-10 h-[80vh] flex flex-col shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900">t('records.addRecord')</h2>
                            <button onClick={() => setShowUploadModal(false)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 flex-1 overflow-y-auto pb-4">
                            <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
                                <div onClick={addPage} className="flex-shrink-0 w-24 h-32 bg-slate-50 border-2 border-dashed border-blue-300 rounded-xl flex flex-col items-center justify-center cursor-pointer active:bg-blue-50 text-blue-500">
                                    <CameraIcon size={24} className="mb-1" />
                                    <span className="text-[10px] font-bold">{t('records.addPage')}</span>
                                </div>
                                {newReport.previews.map((src, idx) => (
                                    <div key={idx} className="flex-shrink-0 w-24 h-32 bg-slate-100 rounded-xl overflow-hidden relative shadow-sm border border-slate-100">
                                        <img src={src} className="w-full h-full object-cover" />
                                        <button onClick={() => removePage(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md"><X size={10} /></button>
                                        <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 rounded">{idx + 1}</span>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">{t('records.recordTitle')}</label>
                                <input type="text" placeholder="e.g. Blood Test Report" className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-medium" value={newReport.title} onChange={e => setNewReport({...newReport, title: e.target.value})} />
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">{t('records.category')}</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {['Prescription', 'Lab Report', 'Invoice', 'Other'].map(cat => (
                                        <button type="button" key={cat} onClick={() => setNewReport({...newReport, category: cat})} className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all active:scale-95 ${newReport.category === cat ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{cat}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 bg-white">
                            <button onClick={handleUpload} disabled={uploading || newReport.images.length === 0} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed">
                                {uploading ? <><UploadCloud className="mr-2 animate-bounce" size={20} /> {t('records.uploading')}</> : t('records.saveRecordCount', { count: newReport.images.length })}
                            </button>
                        </div>
                    </div>
                </div>
            )}

<div className="h-32 w-full flex-shrink-0 block"></div>

        </div>
    );
};

export default MedicalRecords;