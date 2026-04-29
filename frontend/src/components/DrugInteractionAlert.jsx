// DrugInteractionAlert.jsx — new small component
import { AlertTriangle, CheckCircle, WifiOff, Info } from 'lucide-react';

const DrugInteractionAlert = ({ result, onDismiss }) => {
    if (!result) return null;

    // SAFE
    if (result.status === 'SAFE') {
        return (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
                <CheckCircle size={16} className="flex-shrink-0" />
                <span className="font-medium">No interactions found. Safe to add.</span>
            </div>
        );
    }

    // ERROR / Offline
    if (result.status === 'ERROR') {
        return (
            <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-sm">
                <WifiOff size={16} className="flex-shrink-0" />
                <span>{result.message}</span>
            </div>
        );
    }

    // DANGER — supports multiple interactions
    if (result.status === 'DANGER') {
        const interactions = result.interactions || [];
        return (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                    <AlertTriangle size={16} className="flex-shrink-0" />
                    {interactions.length > 1
                        ? `${interactions.length} Drug Interactions Detected!`
                        : 'Drug Interaction Detected!'
                    }
                </div>

                {interactions.map((interaction, i) => (
                    <div key={i} className="bg-white rounded-lg p-3 border border-red-100 space-y-1">
                        {/* Severity badge */}
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            interaction.severity === 'SEVERE'
                                ? 'bg-red-600 text-white'
                                : 'bg-orange-500 text-white'
                        }`}>
                            {interaction.severity}
                        </span>

                        {/* Drugs involved */}
                        <p className="text-xs font-bold text-red-800">
                            {interaction.drug1} + {interaction.drug2}
                        </p>

                        {/* Warning */}
                        <p className="text-xs text-red-700">{interaction.description}</p>

                        {/* Recommendation */}
                        {interaction.recommendation && (
                            <div className="flex items-start gap-1.5 mt-1">
                                <Info size={11} className="text-orange-500 mt-0.5 flex-shrink-0" />
                                <p className="text-[11px] text-orange-700 font-medium">
                                    {interaction.recommendation}
                                </p>
                            </div>
                        )}
                    </div>
                ))}

                {/* Disclaimer */}
                <p className="text-[10px] text-red-500 italic">
                    AI analysis only. Consult your doctor before making any changes.
                </p>

                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="w-full text-xs text-red-500 font-medium py-1.5 border border-red-200 rounded-lg hover:bg-red-50"
                    >
                        I understand, continue anyway
                    </button>
                )}
            </div>
        );
    }

    return null;
};

export default DrugInteractionAlert;