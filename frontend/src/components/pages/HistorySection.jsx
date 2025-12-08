import React, { useEffect, useState } from 'react';
import { useMedicines } from '../../hooks/useMedicines';

const HistorySection = () => {
  const { fetchLogs, addLog } = useMedicines();
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const load = async () => {
      const data = await fetchLogs();
      setLogs(data);
    };
    load();
  }, []);

 const handleLog = async (log, status) => {
  try {
    const response = await fetch(`https://medmind-qnpv.onrender.com/api/medicines/logs/${log._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify({ status })   // ✅ sending status properly
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Something went wrong");
      return;
    }

    alert(data.message);

    // refresh logs
    const updated = await fetchLogs();
    setLogs(updated);
  } catch (error) {
    console.error("Error updating log:", error);
    alert("Error updating log");
  }
};


  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">📜 Medicine History</h2>
      {logs.length > 0 ? (
        <div className="space-y-4">
          {logs.slice(0, 20).map((log) => (
            <div key={log._id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-semibold">{log.medicineId?.name} ({log.medicineId?.dose})</p>
                <p className="text-sm text-gray-600">{new Date(log.date).toLocaleDateString()} at {log.time}</p>
              </div>
              <div>
                {log.status === 'pending' ? (
                  <div className="space-x-2">
                   <button
  onClick={() => handleLog(log, 'taken')}
  className="px-3 py-1 bg-green-500 text-white rounded-md"
>
  Taken
</button>

<button
  onClick={() => handleLog(log, 'missed')}
  className="px-3 py-1 bg-red-500 text-white rounded-md"
>
  Missed
</button>

                  </div>
                ) : (
                  <span className={`px-3 py-1 rounded-md text-white ${log.status === 'taken' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {log.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600">No history yet</p>
      )}
    </div>
  );
};

export default HistorySection;
