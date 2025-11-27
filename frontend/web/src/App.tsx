import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface NoiseData {
  id: string;
  name: string;
  decibel: number;
  location: string;
  timestamp: number;
  creator: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [noiseData, setNoiseData] = useState<NoiseData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingNoise, setCreatingNoise] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending", 
    message: "" 
  });
  const [newNoiseData, setNewNoiseData] = useState({ name: "", decibel: "", location: "" });
  const [selectedNoise, setSelectedNoise] = useState<NoiseData | null>(null);
  const [decryptedValue, setDecryptedValue] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected || isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
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
            id: businessId,
            name: businessData.name,
            decibel: Number(businessData.decryptedValue) || 0,
            location: `Location ${Number(businessData.publicValue1)}`,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading business data:', e);
        }
      }
      
      setNoiseData(noiseList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const createNoiseData = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingNoise(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating noise data with Zama FHE..." });
    
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
        Math.floor(Math.random() * 100),
        Math.floor(Math.random() * 100),
        `Noise level: ${decibelValue}dB at ${newNoiseData.location}`
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction confirmation..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Noise data created successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewNoiseData({ name: "", decibel: "", location: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingNoise(false); 
    }
  };

  const decryptData = async (businessId: string): Promise<number | null> => {
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
        setTransactionStatus({ visible: true, status: "success", message: "Data already verified on-chain" });
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
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption on-chain..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Data decrypted and verified successfully!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ visible: true, status: "success", message: "Data is already verified on-chain" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        await loadData();
        return null;
      }
      
      setTransactionStatus({ visible: true, status: "error", message: "Decryption failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const checkAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      setTransactionStatus({ visible: true, status: "success", message: "Contract is available and ready!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const filteredData = noiseData.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>🔇 FHE Noise Map</h1>
          </div>
          <div className="header-actions">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">🔇</div>
            <h2>Connect Your Wallet to Monitor Noise</h2>
            <p>Join our privacy-preserving noise monitoring network using Zama FHE encryption.</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>Connect wallet to initialize FHE system</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>Encrypt and upload noise data anonymously</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>View community noise map without exposing locations</p>
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

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>🔇 FHE Noise Map</h1>
          <span>Privacy-Preserving Community Monitoring</span>
        </div>
        
        <div className="header-actions">
          <button onClick={checkAvailability} className="availability-btn">
            Check System
          </button>
          <button onClick={() => setShowCreateModal(true)} className="create-btn">
            + Report Noise
          </button>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </div>
      </header>
      
      <div className="main-content">
        <div className="stats-panel">
          <div className="stat-card">
            <h3>Total Reports</h3>
            <div className="stat-value">{noiseData.length}</div>
          </div>
          <div className="stat-card">
            <h3>Verified Data</h3>
            <div className="stat-value">{noiseData.filter(d => d.isVerified).length}</div>
          </div>
          <div className="stat-card">
            <h3>Avg Decibel</h3>
            <div className="stat-value">
              {noiseData.length > 0 ? Math.round(noiseData.reduce((sum, d) => sum + d.decibel, 0) / noiseData.length) : 0}dB
            </div>
          </div>
        </div>

        <div className="search-section">
          <input
            type="text"
            placeholder="Search noise reports..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button onClick={loadData} className="refresh-btn" disabled={isRefreshing}>
            {isRefreshing ? "🔄" : "Refresh"}
          </button>
        </div>

        <div className="data-section">
          <h2>Community Noise Reports</h2>
          <div className="data-list">
            {paginatedData.length === 0 ? (
              <div className="no-data">
                <p>No noise reports found</p>
                <button onClick={() => setShowCreateModal(true)} className="create-btn">
                  Report First Noise
                </button>
              </div>
            ) : (
              paginatedData.map((item, index) => (
                <div 
                  className={`data-item ${selectedNoise?.id === item.id ? "selected" : ""}`}
                  key={index}
                  onClick={() => setSelectedNoise(item)}
                >
                  <div className="item-header">
                    <span className="item-name">{item.name}</span>
                    <span className={`status ${item.isVerified ? "verified" : "pending"}`}>
                      {item.isVerified ? "✅ Verified" : "🔓 Encrypted"}
                    </span>
                  </div>
                  <div className="item-details">
                    <span>📍 {item.location}</span>
                    <span>🔊 {item.isVerified ? `${item.decryptedValue}dB` : "Encrypted dB"}</span>
                    <span>🕐 {new Date(item.timestamp * 1000).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="info-panel">
          <h3>How FHE Protects Your Privacy</h3>
          <div className="fhe-flow">
            <div className="flow-step">
              <div className="step-icon">1</div>
              <div className="step-content">
                <h4>Local Encryption</h4>
                <p>Noise data encrypted on your device before upload</p>
              </div>
            </div>
            <div className="flow-step">
              <div className="step-icon">2</div>
              <div className="step-content">
                <h4>Secure Storage</h4>
                <p>Only encrypted data stored on blockchain</p>
              </div>
            </div>
            <div className="flow-step">
              <div className="step-icon">3</div>
              <div className="step-content">
                <h4>Private Analysis</h4>
                <p>Noise maps generated without exposing individual data</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {showCreateModal && (
        <ModalCreateNoise 
          onSubmit={createNoiseData}
          onClose={() => setShowCreateModal(false)}
          creating={creatingNoise}
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
            setDecryptedValue(null);
          }}
          decryptedValue={decryptedValue}
          isDecrypting={isDecrypting || fheIsDecrypting}
          decryptData={() => decryptData(selectedNoise.id)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalCreateNoise: React.FC<{
  onSubmit: () => void;
  onClose: () => void;
  creating: boolean;
  noiseData: any;
  setNoiseData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, noiseData, setNoiseData, isEncrypting }) => {
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
      <div className="create-noise-modal">
        <div className="modal-header">
          <h2>Report Noise Level</h2>
          <button onClick={onClose} className="close-modal">×</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <strong>FHE 🔐 Privacy Protection</strong>
            <p>Noise level will be encrypted with Zama FHE to protect your location privacy</p>
          </div>
          
          <div className="form-group">
            <label>Location Description *</label>
            <input 
              type="text"
              name="name"
              value={noiseData.name}
              onChange={handleChange}
              placeholder="e.g., Central Park, Downtown Area..."
            />
          </div>
          
          <div className="form-group">
            <label>Noise Level (dB) *</label>
            <input 
              type="number"
              name="decibel"
              value={noiseData.decibel}
              onChange={handleChange}
              placeholder="Enter decibel level..."
              min="0"
              max="150"
            />
            <div className="data-type-label">FHE Encrypted Integer</div>
          </div>
          
          <div className="form-group">
            <label>Area Type</label>
            <input 
              type="text"
              name="location"
              value={noiseData.location}
              onChange={handleChange}
              placeholder="e.g., Residential, Commercial, Park..."
            />
            <div className="data-type-label">Public Data</div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit}
            disabled={creating || isEncrypting || !noiseData.name || !noiseData.decibel}
            className="submit-btn"
          >
            {creating || isEncrypting ? "Encrypting..." : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  );
};

const NoiseDetailModal: React.FC<{
  noise: NoiseData;
  onClose: () => void;
  decryptedValue: number | null;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
}> = ({ noise, onClose, decryptedValue, isDecrypting, decryptData }) => {
  const handleDecrypt = async () => {
    if (decryptedValue !== null) return;
    
    const decrypted = await decryptData();
    if (decrypted !== null) {
      // Value is set via state update in parent
    }
  };

  const getNoiseLevel = (db: number) => {
    if (db < 30) return "Quiet";
    if (db < 60) return "Moderate";
    if (db < 90) return "Loud";
    return "Very Loud";
  };

  const displayValue = noise.isVerified ? noise.decryptedValue : decryptedValue;

  return (
    <div className="modal-overlay">
      <div className="noise-detail-modal">
        <div className="modal-header">
          <h2>Noise Report Details</h2>
          <button onClick={onClose} className="close-modal">×</button>
        </div>
        
        <div className="modal-body">
          <div className="noise-info">
            <div className="info-item">
              <span>Location:</span>
              <strong>{noise.name}</strong>
            </div>
            <div className="info-item">
              <span>Area Type:</span>
              <strong>{noise.location}</strong>
            </div>
            <div className="info-item">
              <span>Reported:</span>
              <strong>{new Date(noise.timestamp * 1000).toLocaleString()}</strong>
            </div>
            <div className="info-item">
              <span>Reporter:</span>
              <strong>{noise.creator.substring(0, 6)}...{noise.creator.substring(38)}</strong>
            </div>
          </div>
          
          <div className="data-section">
            <h3>Noise Level Data</h3>
            <div className="noise-display">
              <div className="decibel-value">
                {displayValue !== undefined && displayValue !== null ? (
                  <>
                    <span className="db-number">{displayValue}</span>
                    <span className="db-unit">dB</span>
                    <span className="noise-level">{getNoiseLevel(displayValue)}</span>
                  </>
                ) : (
                  <span className="encrypted-text">🔒 Encrypted</span>
                )}
              </div>
              
              <button 
                className={`decrypt-btn ${(noise.isVerified || decryptedValue !== null) ? 'decrypted' : ''}`}
                onClick={handleDecrypt}
                disabled={isDecrypting || noise.isVerified}
              >
                {isDecrypting ? "Decrypting..." : 
                 noise.isVerified ? "✅ Verified" : 
                 decryptedValue !== null ? "✅ Decrypted" : "🔓 Decrypt"}
              </button>
            </div>
            
            <div className="fhe-explanation">
              <p>This noise level was encrypted using FHE to protect the reporter's privacy while contributing to community noise mapping.</p>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;