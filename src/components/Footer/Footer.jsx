import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

export const Footer = () => (
    <div className={styles.footerContainer}>
        <div className={styles.footerSingleLine}>
            <span>
                This website is not affiliated with Vine sauce. It is a fan-made website that allows users to search for quotes from youtube videos.
                <Link to="/privacy" className={styles.privacyLink}>
                    Privacy Policy
                </Link>
            </span>
        </div>
    </div>
); 