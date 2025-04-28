import { useEffect, useState, useCallback } from 'react';

export const KofiButton = ({ onFeedbackClick, submittingFeedback }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [isScrolling, setIsScrolling] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Throttled scroll handler
    const handleScroll = useCallback(() => {
        if (isScrolling || !isMobile) return;
        
        setIsScrolling(true);
        setTimeout(() => {
            const currentScrollY = window.scrollY;
            
            // Hide if scrolling down, show if scrolling up
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                setIsVisible(false);
            } else {
                setIsVisible(true);
            }
            
            setLastScrollY(currentScrollY);
            setIsScrolling(false);
        }, 50); // 50ms throttle
    }, [lastScrollY, isScrolling, isMobile]);

    useEffect(() => {
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [handleScroll]);

    return (
        <button
            onClick={onFeedbackClick}
            disabled={submittingFeedback}
            style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                backgroundColor: 'var(--accent-color)',
                color: 'white',
                border: 'none',
                borderRadius: '30px',
                padding: '10px 20px',
                boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
                cursor: 'pointer',
                zIndex: 900,
                fontSize: '1rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.3s ease',
                opacity: isMobile ? (isVisible ? 1 : 0) : 1,
                transform: isMobile ? (isVisible ? 'translateY(0)' : 'translateY(20px)') : 'none',
                pointerEvents: isMobile ? (isVisible ? 'auto' : 'none') : 'auto'
            }}
        >
            💡 Send Feedback
        </button>
    );
}; 