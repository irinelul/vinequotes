import styles from './Modals.module.css';

export const DonationModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: 400, textAlign: 'center' }}>
                <h3>Support the Project</h3>
                <p>
                    If you enjoy using this site, please consider supporting it! Your donation helps keep the project running and improves the database for everyone.
                </p>
                <button
                    onClick={() => window.open('https://ko-fi.com/quoteseraches', '_blank')}
                    style={{
                        background: '#00b9fe',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.75rem 2rem',
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        margin: '1rem 0',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                    }}
                >
                    ☕ Donate on Ko-fi
                </button>
                <div>
                    <button type="button" onClick={onClose} style={{ marginTop: 8 }}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}; 