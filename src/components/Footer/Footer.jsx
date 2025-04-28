import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

export const Footer = () => (
    <div className={styles.footerContainer}>
        <div className={styles.footerSingleLine}>
            <span>
                This website is not affiliated with Joe Rogan or Spotify. It is a fan-made website that allows users to search for quotes from the Joe Rogan Experience podcast.
                <Link to="/privacy" className={styles.privacyLink}>
                    Privacy Policy
                </Link>
            </span>
        </div>
        <div className={styles.projectLinkWrapper}>
            <a
                href="https://linktr.ee/quotesearch"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.projectLink}
            >
                Check our other projects here
            </a>
        </div>
    </div>
); 