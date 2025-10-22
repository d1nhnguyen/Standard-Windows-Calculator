const CONFIG = {
    MAX_DIGITS: 16,
    LOCALE: 'de-DE',
    MAX_DECIMALS: 10,
    DECIMAL_SEPARATOR: ',',
    THOUSANDS_SEPARATOR: '.'
};

const OPERATORS = {
    ADD: '+',
    SUBTRACT: '−',
    MULTIPLY: '×',
    DIVIDE: '÷'
};


class DisplayManager {
    constructor(displayElement, equationElement) {
        this.display = displayElement;
        this.equation = equationElement;
    }

    updateResult(value) {
        this.display.textContent = this.format(value);
    }

    updateEquation(text) {
        this.equation.textContent = text;
    }

    clearEquation() {
        this.equation.textContent = '';
    }

    format(value) {
        if (value === 'Error' || !isFinite(value)) {
            return 'Error';
        }

        return value.toLocaleString(CONFIG.LOCALE, {
            maximumFractionDigits: CONFIG.MAX_DECIMALS
        });
    }

    getCurrentValue() {
        const displayText = this.display.textContent;
        if (displayText === 'Error') return 0;

        let cleanString = displayText.replace(new RegExp('\\' + CONFIG.THOUSANDS_SEPARATOR, 'g'), '');
        cleanString = cleanString.replace(CONFIG.DECIMAL_SEPARATOR, '.');
        
        return parseFloat(cleanString) || 0;
    }
}

// History Manager Class
class HistoryManager {
    constructor(listElement, noHistoryElement) {
        this.list = listElement;
        this.noHistoryMessage = noHistoryElement;
    }

    addEntry(equation, result) {
        if (this.noHistoryMessage) {
            this.noHistoryMessage.style.display = 'none';
        }

        const item = document.createElement('li');
        
        const equationSpan = document.createElement('span');
        equationSpan.className = 'history-equation';
        equationSpan.textContent = equation;

        const resultSpan = document.createElement('span');
        resultSpan.className = 'history-result';
        resultSpan.textContent = result;

        item.appendChild(equationSpan);
        item.appendChild(resultSpan);
        this.list.appendChild(item);
    }

    clear() {
        this.list.innerHTML = '';
        if (this.noHistoryMessage) {
            this.noHistoryMessage.style.display = 'block';
        }
    }
}

// Input Handler Class
class InputHandler {
    constructor(calculator) {
        this.calc = calculator;
        this.currentInput = '0';
    }

    handleDigit(digit) {
        if (this.calc.waitingForNewInput) {
            this.currentInput = digit;
            this.calc.waitingForNewInput = false;
        } else {
            const cleanInput = this.currentInput.replace(new RegExp('\\' + CONFIG.THOUSANDS_SEPARATOR, 'g'), '');
            const digitCount = cleanInput.replace(CONFIG.DECIMAL_SEPARATOR, '').length;

            if (digitCount >= CONFIG.MAX_DIGITS) {
                return this.currentInput;
            }

            if (this.currentInput === '0') {
                this.currentInput = digit;
            } else {
                this.currentInput += digit;
            }
        }

        return this.formatInput(this.currentInput);
    }

    handleDecimal() {
        if (this.calc.waitingForNewInput) {
            this.currentInput = '0' + CONFIG.DECIMAL_SEPARATOR;
            this.calc.waitingForNewInput = false;
        } else if (!this.currentInput.includes(CONFIG.DECIMAL_SEPARATOR)) {
            this.currentInput += CONFIG.DECIMAL_SEPARATOR;
        }

        return this.formatInput(this.currentInput);
    }

    formatInput(value) {
        const parts = value.split(CONFIG.DECIMAL_SEPARATOR);
        const integerPart = parts[0] || '0';
        const decimalPart = parts[1];

        let formatted = parseFloat(integerPart).toLocaleString(CONFIG.LOCALE, {
            maximumFractionDigits: 0
        });

        if (decimalPart !== undefined) {
            formatted += CONFIG.DECIMAL_SEPARATOR + decimalPart;
        }

        this.currentInput = value;
        return formatted;
    }

    reset() {
        this.currentInput = '0';
    }

    backspace(currentDisplay) {
        let current = currentDisplay.replace(new RegExp('\\' + CONFIG.THOUSANDS_SEPARATOR, 'g'), '');
        
        if (current.length <= 1 || current === '0') {
            this.currentInput = '0';
            return '0';
        }

        current = current.slice(0, -1);
        this.currentInput = current;
        return this.formatInput(current);
    }
}

// Calculator Engine Class
class CalculatorEngine {
    constructor(displayManager, historyManager) {
        this.display = displayManager;
        this.history = historyManager;
        this.inputHandler = new InputHandler(this);
        
        this.firstValue = null;
        this.operator = null;
        this.waitingForNewInput = false;
        this.justCalculated = false;
        this.lastFullEquation = null;
    }

    handleNumber(value) {
        if (this.justCalculated) {
            this.firstValue = null;
            this.operator = null;
            this.display.clearEquation();
            this.justCalculated = false;
            this.lastFullEquation = null; 
        }
        
        let result;
        if (value === '.') {
            result = this.inputHandler.handleDecimal();
        } else {
            result = this.inputHandler.handleDigit(value);
        }
        // this.display.updateResult(result);
        this.display.display.textContent = result;
    }

    handleOperator(op) {
        this.justCalculated = false;
        this.lastFullEquation = null; 
        const currentValue = this.display.getCurrentValue();

        if (this.firstValue !== null && this.operator !== null && !this.waitingForNewInput) {
            const result = this.calculate(this.firstValue, this.operator, currentValue);
            
            const equation = `${this.display.format(this.firstValue)} ${this.operator} ${this.display.format(currentValue)} =`;
            const formattedResult = this.display.format(result);
            
            this.history.addEntry(equation, formattedResult);
            this.display.updateResult(result);
            
            this.firstValue = result;
        } else {
            this.firstValue = currentValue;
        }

        this.operator = op;
        this.waitingForNewInput = true;
        this.display.updateEquation(`${this.display.format(this.firstValue)} ${op}`);
    }

    handleEquals() {
        if (this.operator === null) {
            const currentValue = this.display.getCurrentValue();
            const formattedValue = this.display.format(currentValue);
            
            let equation;
            if (this.lastFullEquation) {
                equation = `${this.lastFullEquation} =`;
                this.lastFullEquation = null; 
            } else {
                equation = `${formattedValue} =`;
            }
            
            this.history.addEntry(equation, formattedValue);
            this.display.updateEquation(equation); 
            
            this.firstValue = currentValue;
            this.operator = null;
            this.waitingForNewInput = true;
            this.justCalculated = true;
            return;
        }

        // Handle '9 + 9 ='
        if (this.firstValue === null || this.waitingForNewInput) {
            return;
        }

        const secondValue = this.display.getCurrentValue();
        const result = this.calculate(this.firstValue, this.operator, secondValue);

        const equation = `${this.display.format(this.firstValue)} ${this.operator} ${this.display.format(secondValue)} =`;
        const formattedResult = this.display.format(result);

        this.history.addEntry(equation, formattedResult);
        this.display.updateResult(result);
        this.display.clearEquation(); // Clear display after binary op

        this.firstValue = result;
        this.operator = null;
        this.waitingForNewInput = true;
        this.justCalculated = true;
        this.lastFullEquation = null; // <-- RESET
    }

    calculate(first, op, second) {
        try {
            let result;
            
            switch(op) {
                case OPERATORS.ADD:
                    result = first + second;
                    break;
                case OPERATORS.SUBTRACT:
                    result = first - second;
                    break;
                case OPERATORS.MULTIPLY:
                    result = first * second;
                    break;
                case OPERATORS.DIVIDE:
                    if (second === 0) {
                        throw new Error('Cannot divide by zero');
                    }
                    result = first / second;
                    break;
                default:
                    result = second;
            }

            if (!isFinite(result)) {
                throw new Error('Result is not finite');
            }

            return result;
        } catch (error) {
            console.error('Calculation error:', error);
            return 'Error';
        }
    }

    handlePercent() {
        // --- REWRITTEN to behave like square root ---
        const currentValue = this.display.getCurrentValue();
        const result = currentValue / 100;
        // Using a simple 'percent' string for the equation
        const equation = `percent(${this.display.format(currentValue)})`;

        this.display.updateResult(result);
        this.display.updateEquation(equation);
        
        this.waitingForNewInput = true;
        this.justCalculated = true; 
        this.firstValue = result; // Store result for chaining
        this.operator = null; // It's a terminal op
        this.lastFullEquation = equation; // Store for equals
    }

    handleSquareRoot() {
        // --- REWRITTEN as requested ---
        const currentValue = this.display.getCurrentValue();
        
        if (currentValue < 0) {
            this.display.updateResult('Error');
            this.waitingForNewInput = true;
            this.justCalculated = true;
            this.lastFullEquation = null;
            this.operator = null;
        } else {
            const result = Math.sqrt(currentValue);
            const equation = `²√(${this.display.format(currentValue)})`;

            this.display.updateResult(result);
            this.display.updateEquation(equation); // Show '²√(9)'
            
            this.waitingForNewInput = true;
            this.justCalculated = true;
            this.firstValue = result; // Store '3' for chaining
            this.operator = null; // It's a terminal op
            this.lastFullEquation = equation; // Store '²√(9)' for equals
        }
    }

    handleNegate() {
        if (this.justCalculated) {
            this.justCalculated = false;
            this.lastFullEquation = null; // <-- RESET
        }
        const currentValue = this.display.getCurrentValue();
        this.display.updateResult(-currentValue);
        this.inputHandler.currentInput = this.display.display.textContent.replace(new RegExp('\\' + CONFIG.THOUSANDS_SEPARATOR, 'g'), '');
    }

    handleClear() {
        this.firstValue = null;
        this.operator = null;
        this.waitingForNewInput = false;
        this.justCalculated = false;
        this.lastFullEquation = null; // <-- RESET
        this.inputHandler.reset();
        this.display.updateResult('0');
        this.display.clearEquation();
    }

    handleClearEntry() {
        this.inputHandler.reset();
        this.display.updateResult('0');
        this.justCalculated = false;
        this.lastFullEquation = null; // <-- RESET
    }

    handleBackspace() {
        if (this.justCalculated) {
            this.firstValue = null;
            this.operator = null;
            this.display.clearEquation();
            this.justCalculated = false;
            this.lastFullEquation = null; // <-- RESET
        }
        
        const currentDisplay = this.display.display.textContent;
        const result = this.inputHandler.backspace(currentDisplay);
        // this.display.updateResult(result);
        this.display.display.textContent = result;
    }
}

// UI Controller Class
class UIController {
    constructor() {
        this.initializeElements();
        this.initializeManagers();
        this.bindEvents();
    }

    initializeElements() {
        this.menuBtn = document.querySelector('.menu-btn');
        this.appContainer = document.querySelector('.calculator-app');
        this.keypad = document.querySelector('.keypad');
    }

    initializeManagers() {
        const displayElement = document.querySelector('.result-display');
        const equationElement = document.querySelector('.equation-display');
        const historyList = document.querySelector('.history-list');
        const noHistoryMsg = document.querySelector('.no-history-message');

        this.displayManager = new DisplayManager(displayElement, equationElement);
        this.historyManager = new HistoryManager(historyList, noHistoryMsg);
        this.calculator = new CalculatorEngine(this.displayManager, this.historyManager);
    }

    bindEvents() {
        // Sidebar toggle
        this.menuBtn.addEventListener('click', () => {
            this.appContainer.classList.toggle('sidebar-open');
        });

        // Single event listener for all calculator buttons
        this.keypad.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn || !btn.dataset.action) return;

            this.handleButtonClick(btn);
        });

        // Keyboard support
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    handleButtonClick(btn) {
        const action = btn.dataset.action;

        switch(action) {
            case 'number':
                this.calculator.handleNumber(btn.dataset.value);
                break;
            case 'operator':
                this.calculator.handleOperator(btn.dataset.operator);
                break;
            case 'equals':
                this.calculator.handleEquals();
                break;
            case 'clear':
                this.calculator.handleClear();
                this.historyManager.clear();
                break;
            case 'clear-entry':
                this.calculator.handleClearEntry();
                break;
            case 'backspace':
                this.calculator.handleBackspace();
                break;
            case 'percent':
                this.calculator.handlePercent();
                break;
            case 'sqrt':
                this.calculator.handleSquareRoot();
                break;
            case 'negate':
                this.calculator.handleNegate();
                break;
            // Add cases for other buttons if needed (e.g., reciprocal, square)
        }
    }

    handleKeyboard(e) {
        const keyMap = {
            '0': () => this.calculator.handleNumber('0'),
            '1': () => this.calculator.handleNumber('1'),
            '2': () => this.calculator.handleNumber('2'),
            '3': () => this.calculator.handleNumber('3'),
            '4': () => this.calculator.handleNumber('4'),
            '5': () => this.calculator.handleNumber('5'),
            '6': () => this.calculator.handleNumber('6'),
            '7': () => this.calculator.handleNumber('7'),
            '8': () => this.calculator.handleNumber('8'),
            '9': () => this.calculator.handleNumber('9'),
            '.': () => this.calculator.handleNumber('.'),
            ',': () => this.calculator.handleNumber('.'),
            '+': () => this.calculator.handleOperator(OPERATORS.ADD),
            '-': () => this.calculator.handleOperator(OPERATORS.SUBTRACT),
            '*': () => this.calculator.handleOperator(OPERATORS.MULTIPLY),
            '/': () => { e.preventDefault(); this.calculator.handleOperator(OPERATORS.DIVIDE); },
            'Enter': () => { e.preventDefault(); this.calculator.handleEquals(); },
            '=': () => this.calculator.handleEquals(),
            'Escape': () => this.calculator.handleClear(),
            'c': () => this.calculator.handleClear(),
            'C': () => this.calculator.handleClear(),
            'Backspace': () => { e.preventDefault(); this.calculator.handleBackspace(); },
            '%': () => this.calculator.handlePercent()
        };

        const handler = keyMap[e.key];
        if (handler) {
            handler();
        }
    }
}

// Initialize the calculator
const calculator = new UIController();