import React from 'react';
import { ChannelRadioButton } from './ChannelRadioButton';
import { Filters } from './Filters';
import Disclaimer from './Disclaimer';
import { Quotes } from './Quotes';
import { PaginationButtons } from './PaginationButtons';
import { Footer } from './Footer/Footer';
import { FeedbackModal } from './Modals/FeedbackModal';
import { KofiButton } from './KofiButton';

const SearchPage = ({
    searchInput,
    setSearchInput,
    yearInput,
    setYearInput,
    handleSearch,
    handleKeyPress,
    handleResetSearch,
    handleRandomQuotes,
    handleChannelChange,
    handleYearChange,
    handleSortChange,
    handleGameChange,
    handleGameReset,
    loading,
    error,
    channel,
    sort,
    game,
    games,
    page,
    totalPages,
    totalQuotes,
    hasSearched,
    quotes,
    searchTerm,
    numberFormatter,
    strict,
    feedbackModalOpen,
    setFeedbackModalOpen,
    submittingFeedback,
    handleFeedbackSubmit,
    handleLogoClick,
    handlePageChange,
}) => (
    <div className='main-container'>
        <div className="logo-container" onClick={handleLogoClick}>
            <img 
                src="/JRE.webp" 
                alt="JRE Logo"
                onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/JRE.webp";
                }}
            />
        </div>
        <div className="donate-banner" style={{
                        width: '100%',
                        textAlign: 'center',
                        margin: '1rem 0'
                    }}>
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
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                            }}
                        >
                            ☕ Support the Project on Ko-fi
                        </button>
                    </div>
                            <div className="input-container">
            <button
                onClick={handleRandomQuotes}
                disabled={loading}
                style={{
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? 'not-allowed' : 'pointer',
                }}
            >
                {loading ? 'Loading...' : 'Random Quotes'}
            </button>
            
            <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Search quotes..."
                className="search-input"
                style={{ boxSizing: "border-box" }}
            />
            <button onClick={handleSearch}>
                Search
            </button>
            <button
                onClick={handleResetSearch}
                style={{ marginLeft: '0.5rem' }}
            >
                Reset Search
            </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        
        <Filters 
            selectedYear={yearInput}
            handleYearChange={handleYearChange}
            sortOrder={sort}
            handleSortChange={handleSortChange}
            selectedGame={game}
            handleGameChange={handleGameChange}
            handleGameReset={handleGameReset}
            games={games}
            searchTerm={searchTerm}
            page={page}
            selectedChannel={channel}
            strict={strict} 
            yearInput={yearInput}
            setYearInput={setYearInput}
        />

        {!hasSearched && <Disclaimer />}
                
        {loading && <div>Loading...</div>}
        {hasSearched && (
            <>
                <div className="total-quotes">
                    Total quotes found: {numberFormatter.format(totalQuotes)}
                </div>
                <Quotes quotes={quotes} searchTerm={searchTerm} totalQuotes={totalQuotes} />
            </>
        )}

        {quotes.length > 0 && (
            <PaginationButtons
                page={page}
                totalPages={totalPages}
                handlePageChange={handlePageChange}
            />
        )}

        <Footer />

        {/* Improved desktop-only feedback button */}
        <button
            className="floating-feedback-button"
            onClick={() => setFeedbackModalOpen(true)}
            disabled={submittingFeedback}
        >
            💡 Send Feedback
        </button>

        <FeedbackModal
            isOpen={feedbackModalOpen}
            onClose={() => setFeedbackModalOpen(false)}
            onSubmit={handleFeedbackSubmit}
        />
    </div>
);

export default SearchPage; 