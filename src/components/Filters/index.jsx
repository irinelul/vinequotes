import { SearchableDropdown } from "../SearchableDropdown";
import styles from './Filters.module.css';

export const Filters = ({
    selectedYear,
    handleYearChange,
    sortOrder,
    handleSortChange,
    selectedGame,
    handleGameChange,
    handleGameReset,
    games,
    yearInput,
    setYearInput,
}) => (
    <div className={styles.container}>
        <div className={styles.group}>
            <div className="year-tooltip">
                <input
                    type="text"
                    value={yearInput}
                    onChange={e => {
                        setYearInput(e.target.value);
                        handleYearChange(e);
                    }}
                    placeholder="Year (YYYY)"
                    maxLength="4"
                    className={styles.yearInput}
                />
            </div>
            <div className="sort-tooltip">
                <select
                    value={sortOrder}
                    onChange={handleSortChange}
                    className={styles.sortSelect}
                >
                    <option value="default">Default Order</option>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                </select>
            </div>
        </div>
    </div>
)