import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface NoiseData {
  id: number;
  name: string;
  decibel: string;
  location: string;
  timestamp: number;
  creator: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
  encryptedValueHandle?: string;
}

interface NoiseStats {
  totalReports: number;
  averageDecibel: number;
  maxDecibel: number;
  verifiedReports: number;
  recentActivity: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [noiseData, setNoiseData] = useState<NoiseData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingNoise, setReportingNoise] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending" as const, 
    message: "" 
  });
  const [newNoiseData, setNewNoiseData] = useState({ name: "", decibel: "", location: "" });
  const [selectedNoise, setSelectedNoise] = useState<NoiseData | null>(null);
  const [decryptedData, setDecryptedData] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting} = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected) return;
      if (isInitialized) return;
      if (fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        console.log('Initializing FHEVM for noise monitoring...');
        await initialize();
        console.log('FHEVM initialized successfully');
      } catch (error) {
        console.error('Failed to initialize FHEVM:', error);
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const noiseList: NoiseData[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          noiseList.push({
            id: parseInt(businessId.replace('noise-', '')) || Date.now(),
            name: businessData.name,
            decibel: businessId,
            location: businessId,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading noise data:', e);
        }
      }
      
      setNoiseData(noiseList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load noise data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const reportNoise = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setReportingNoise(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting noise data with Zama FHE..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const decibelValue = parseInt(newNoiseData.decibel) || 0;
      const businessId = `noise-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, decibelValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newNoiseData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newNoiseData.location) || 0,
        0,
        "Noise Monitoring Report"
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Uploading encrypted data..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Noise report encrypted and uploaded!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowReportModal(false);
      setNewNoiseData({ name: "", decibel: "", location: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected" 
        : "Upload failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setReportingNoise(false); 
    }
  };

  const decryptNoiseData = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        setTransactionStatus({ visible: true, status: "success", message: "Noise data already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Noise data decrypted successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ visible: true, status: "success", message: "Data already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        await loadData();
        return null;
      }
      
      setTransactionStatus({ visible: true, status: "error", message: "Decryption failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const testAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      setTransactionStatus({ visible: true, status: "success", message: "Contract is available and ready!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Contract test failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const getNoiseStats = (): NoiseStats => {
    const totalReports = noiseData.length;
    const verifiedReports = noiseData.filter(n => n.isVerified).length;
    const recentActivity = noiseData.filter(n => Date.now()/1000 - n.timestamp < 60 * 60 * 24).length;
    
    const decibelValues = noiseData
      .filter(n => n.isVerified && n.decryptedValue)
      .map(n => n.decryptedValue as number);
    
    const averageDecibel = decibelValues.length > 0 
      ? decibelValues.reduce((sum, val) => sum + val, 0) / decibelValues.length 
      : 0;
    
    const maxDecibel = decibelValues.length > 0 ? Math.max(...decibelValues) : 0;

    return {
      totalReports,
      averageDecibel,
      maxDecibel,
      verifiedReports,
      recentActivity
    };
  };

  const filteredNoiseData = noiseData.filter(noise =>
    noise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    noise.creator.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const faqItems = [
    { question: "How does FHE protect my privacy?", answer: "FHE allows noise level encryption before upload, keeping your location and data private while enabling aggregate analysis." },
    { question: "What data is encrypted?", answer: "Only the decibel level is encrypted. Timestamp and area code remain public for mapping purposes." },
    { question: "How accurate is the noise mapping?", answer: "Data is aggregated from multiple encrypted sources to create accurate heatmaps without exposing individual inputs." },
    { question: "Can I delete my noise reports?", answer: "Due to blockchain immutability, reports cannot be deleted but are fully encrypted and anonymous." }
  ];

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>🔇 FHE Noise Map</h1>
            <span>Privacy-Preserving Noise Monitoring</span>
          </div>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="noise-icon">🔇</div>
            <h2>Connect to Monitor Noise Securely</h2>
            <p>Join our privacy-first noise monitoring network using Fully Homomorphic Encryption</p>
            <div className="privacy-features">
              <div className="feature">
                <span className="feature-icon">🔐</span>
                <span>Encrypted Data Upload</span>
              </div>
              <div className="feature">
                <span className="feature-icon">🌍</span>
                <span>Anonymous Contribution</span>
              </div>
              <div className="feature">
                <span className="feature-icon">📊</span>
                <span>Collective Insights</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE Encryption System...</p>
        <p className="loading-note">Securing your noise data with Zama FHE</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading encrypted noise data...</p>
    </div>
  );

  const stats = getNoiseStats();

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-section">
          <h1>🔇 FHE Noise Map</h1>
          <span>Encrypted Urban Sound Monitoring</span>
        </div>
        
        <nav className="main-nav">
          <button 
            className={`nav-btn ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            🌍 Dashboard
          </button>
          <button 
            className={`nav-btn ${activeTab === "reports" ? "active" : ""}`}
            onClick={() => setActiveTab("reports")}
          >
            📊 Noise Reports
          </button>
          <button 
            className={`nav-btn ${activeTab === "faq" ? "active" : ""}`}
            onClick={() => setActiveTab("faq")}
          >
            ❓ FAQ
          </button>
        </nav>

        <div className="header-actions">
          <button 
            onClick={() => setShowReportModal(true)} 
            className="report-btn metal-btn"
          >
            📢 Report Noise
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>
      
      <main className="main-content">
        {activeTab === "dashboard" && (
          <div className="dashboard-tab">
            <div className="stats-grid">
              <div className="stat-card metal-card">
                <div className="stat-icon">📈</div>
                <div className="stat-value">{stats.totalReports}</div>
                <div className="stat-label">Total Reports</div>
              </div>
              <div className="stat-card metal-card">
                <div className="stat-icon">🔊</div>
                <div className="stat-value">{stats.averageDecibel.toFixed(1)}dB</div>
                <div className="stat-label">Average Level</div>
              </div>
              <div className="stat-card metal-card">
                <div className="stat-icon">⚠️</div>
                <div className="stat-value">{stats.maxDecibel}dB</div>
                <div className="stat-label">Peak Level</div>
              </div>
              <div className="stat-card metal-card">
                <div className="stat-icon">✅</div>
                <div className="stat-value">{stats.verifiedReports}</div>
                <div className="stat-label">Verified</div>
              </div>
            </div>
            
            <div className="fhe-flow-section metal-card">
              <h3>🔐 FHE Encryption Flow</h3>
              <div className="flow-steps">
                <div className="flow-step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <strong>Local Encryption</strong>
                    <p>Noise data encrypted on your device before upload</p>
                  </div>
                </div>
                <div className="flow-step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <strong>Secure Storage</strong>
                    <p>Encrypted data stored on blockchain</p>
                  </div>
                </div>
                <div className="flow-step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <strong>Private Analysis</strong>
                    <p>Noise maps generated without exposing individual data</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="action-section metal-card">
              <h3>Quick Actions</h3>
              <div className="action-buttons">
                <button onClick={testAvailability} className="action-btn metal-btn">
                  Test Contract
                </button>
                <button onClick={loadData} className="action-btn metal-btn">
                  Refresh Data
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="reports-tab">
            <div className="reports-header">
              <h2>Noise Reports</h2>
              <div className="reports-controls">
                <input
                  type="text"
                  placeholder="Search reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input metal-input"
                />
                <button onClick={loadData} className="refresh-btn metal-btn">
                  🔄 Refresh
                </button>
              </div>
            </div>

            <div className="reports-list">
              {filteredNoiseData.length === 0 ? (
                <div className="no-reports metal-card">
                  <div className="noise-icon">🔇</div>
                  <p>No noise reports yet</p>
                  <button 
                    className="report-btn metal-btn"
                    onClick={() => setShowReportModal(true)}
                  >
                    Be the first to report
                  </button>
                </div>
              ) : (
                filteredNoiseData.map((noise) => (
                  <div 
                    key={noise.id} 
                    className={`report-card metal-card ${noise.isVerified ? 'verified' : ''}`}
                    onClick={() => setSelectedNoise(noise)}
                  >
                    <div className="report-header">
                      <h4>{noise.name}</h4>
                      <span className={`status-badge ${noise.isVerified ? 'verified' : 'pending'}`}>
                        {noise.isVerified ? '✅ Verified' : '🔒 Encrypted'}
                      </span>
                    </div>
                    <div className="report-details">
                      <div className="detail-item">
                        <span>Decibel Level:</span>
                        <span>{noise.isVerified ? `${noise.decryptedValue}dB` : '🔒 Encrypted'}</span>
                      </div>
                      <div className="detail-item">
                        <span>Area Code:</span>
                        <span>{noise.publicValue1}</span>
                      </div>
                      <div className="detail-item">
                        <span>Reported:</span>
                        <span>{new Date(noise.timestamp * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "faq" && (
          <div className="faq-tab">
            <h2>Frequently Asked Questions</h2>
            <div className="faq-list">
              {faqItems.map((faq, index) => (
                <div key={index} className="faq-item metal-card">
                  <div 
                    className="faq-question"
                    onClick={() => setFaqOpen(faqOpen === index ? null : index)}
                  >
                    <span>{faq.question}</span>
                    <span className="faq-toggle">{faqOpen === index ? '−' : '+'}</span>
                  </div>
                  {faqOpen === index && (
                    <div className="faq-answer">
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showReportModal && (
        <ReportModal 
          onSubmit={reportNoise} 
          onClose={() => setShowReportModal(false)} 
          reporting={reportingNoise} 
          noiseData={newNoiseData} 
          setNoiseData={setNewNoiseData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedNoise && (
        <NoiseDetailModal 
          noise={selectedNoise} 
          onClose={() => { 
            setSelectedNoise(null); 
            setDecryptedData(null); 
          }} 
          decryptedData={decryptedData} 
          isDecrypting={isDecrypting || fheIsDecrypting} 
          decryptData={() => decryptNoiseData(selectedNoise.decibel)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-toast">
          <div className={`toast-content ${transactionStatus.status}`}>
            <div className="toast-icon">
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="toast-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ReportModal: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  reporting: boolean;
  noiseData: any;
  setNoiseData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, reporting, noiseData, setNoiseData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'decibel') {
      const intValue = value.replace(/[^\d]/g, '');
      setNoiseData({ ...noiseData, [name]: intValue });
    } else {
      setNoiseData({ ...noiseData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="report-modal metal-card">
        <div className="modal-header">
          <h2>📢 Report Noise Level</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="encryption-notice">
            <div className="encryption-icon">🔐</div>
            <div>
              <strong>FHE Protected</strong>
              <p>Noise level will be encrypted before upload</p>
            </div>
          </div>
          
          <div className="form-group">
            <label>Location Description</label>
            <input 
              type="text" 
              name="name" 
              value={noiseData.name} 
              onChange={handleChange} 
              placeholder="e.g., Downtown Park, Office Area..." 
              className="metal-input"
            />
          </div>
          
          <div className="form-group">
            <label>Noise Level (dB) - Integer Only</label>
            <input 
              type="number" 
              name="decibel" 
              value={noiseData.decibel} 
              onChange={handleChange} 
              placeholder="Enter decibel level..." 
              step="1"
              min="0"
              max="150"
              className="metal-input"
            />
            <div className="input-hint">FHE Encrypted Integer</div>
          </div>
          
          <div className="form-group">
            <label>Area Code (Public)</label>
            <input 
              type="number" 
              min="1" 
              max="999" 
              name="location" 
              value={noiseData.location} 
              onChange={handleChange} 
              placeholder="Enter area code..." 
              className="metal-input"
            />
            <div className="input-hint">Public Data for Mapping</div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn metal-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={reporting || isEncrypting || !noiseData.name || !noiseData.decibel || !noiseData.location} 
            className="submit-btn metal-btn"
          >
            {reporting || isEncrypting ? "🔐 Encrypting..." : "📢 Report Noise"}
          </button>
        </div>
      </div>
    </div>
  );
};

const NoiseDetailModal: React.FC<{
  noise: NoiseData;
  onClose: () => void;
  decryptedData: number | null;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
}> = ({ noise, onClose, decryptedData, isDecrypting, decryptData }) => {
  const handleDecrypt = async () => {
    if (decryptedData !== null) return;
    await decryptData();
  };

  return (
    <div className="modal-overlay">
      <div className="detail-modal metal-card">
        <div className="modal-header">
          <h2>Noise Report Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="noise-info">
            <div className="info-row">
              <span>Location:</span>
              <strong>{noise.name}</strong>
            </div>
            <div className="info-row">
              <span>Reporter:</span>
              <strong>{noise.creator.substring(0, 6)}...{noise.creator.substring(38)}</strong>
            </div>
            <div className="info-row">
              <span>Date:</span>
              <strong>{new Date(noise.timestamp * 1000).toLocaleDateString()}</strong>
            </div>
            <div className="info-row">
              <span>Area Code:</span>
              <strong>{noise.publicValue1}</strong>
            </div>
          </div>
          
          <div className="data-section">
            <h3>Encrypted Noise Data</h3>
            <div className="data-display">
              <div className="data-value">
                {noise.isVerified ? 
                  `${noise.decryptedValue} dB (Verified)` : 
                  decryptedData !== null ? 
                  `${decryptedData} dB (Decrypted)` : 
                  "🔒 Encrypted"
                }
              </div>
              <button 
                className={`decrypt-btn metal-btn ${(noise.isVerified || decryptedData !== null) ? 'decrypted' : ''}`}
                onClick={handleDecrypt} 
                disabled={isDecrypting || noise.isVerified}
              >
                {isDecrypting ? "🔓 Decrypting..." : 
                 noise.isVerified ? "✅ Verified" : 
                 decryptedData !== null ? "🔄 Re-decrypt" : 
                 "🔓 Decrypt"}
              </button>
            </div>
          </div>

          {(noise.isVerified || decryptedData !== null) && (
            <div className="analysis-section">
              <h3>Noise Level Analysis</h3>
              <div className="noise-meter">
                <div 
                  className="meter-fill" 
                  style={{ width: `${Math.min(100, ((noise.isVerified ? noise.decryptedValue! : decryptedData!) / 120) * 100)}%` }}
                >
                  <span className="meter-value">
                    {noise.isVerified ? noise.decryptedValue! : decryptedData!} dB
                  </span>
                </div>
              </div>
              <div className="noise-assessment">
                {((noise.isVerified ? noise.decryptedValue! : decryptedData!) < 60) && "Quiet - Normal conversation level"}
                {((noise.isVerified ? noise.decryptedValue! : decryptedData!) >= 60 && (noise.isVerified ? noise.decryptedValue! : decryptedData!) < 80) && "Moderate - Office environment"}
                {((noise.isVerified ? noise.decryptedValue! : decryptedData!) >= 80 && (noise.isVerified ? noise.decryptedValue! : decryptedData!) < 100) && "Loud - Potential hearing risk"}
                {((noise.isVerified ? noise.decryptedValue! : decryptedData!) >= 100) && "Very Loud - Hearing protection recommended"}
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn metal-btn">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;


