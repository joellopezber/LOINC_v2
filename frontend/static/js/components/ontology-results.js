class OntologyResults extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
    }

    static get observedAttributes() {
        return ['data'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'data' && oldValue !== newValue) {
            this.render();
        }
    }

    get data() {
        try {
            return JSON.parse(this.getAttribute('data') || '{}');
        } catch (e) {
            console.error('Error parsing data:', e);
            return {};
        }
    }

    render() {
        const data = this.data;
        const loincCodes = data.loinc_codes || {};
        const loincArray = Array.isArray(loincCodes) ? loincCodes : Object.values(loincCodes);
        
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    font-family: 'Roboto', sans-serif;
                    color: #333;
                    margin: 1rem;
                }
                
                .section {
                    margin-bottom: 1.5rem;
                    background: #fff;
                    border-radius: 8px;
                    padding: 1rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                h3 {
                    color: #2196F3;
                    margin-top: 0;
                    font-size: 1.1rem;
                    border-bottom: 2px solid #e0e0e0;
                    padding-bottom: 0.5rem;
                }
                
                .term {
                    font-size: 1.2rem;
                    font-weight: 500;
                    color: #1976D2;
                    margin-bottom: 1rem;
                }
                
                .list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin: 0;
                    padding: 0;
                    list-style: none;
                }
                
                .tag {
                    background: #E3F2FD;
                    color: #1976D2;
                    padding: 0.25rem 0.75rem;
                    border-radius: 16px;
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                
                .tag .code {
                    font-family: monospace;
                    font-weight: 500;
                }
                
                .tag .details {
                    opacity: 0.8;
                    font-size: 0.85rem;
                }
            </style>
            
            <div class="section">
                <h3>English Term</h3>
                <div class="term">${data.term_in_english || ''}</div>
            </div>
            
            <div class="section">
                <h3>Related Terms</h3>
                <ul class="list">
                    ${(data.related_terms || []).map(term => `
                        <li class="tag">${term}</li>
                    `).join('')}
                </ul>
            </div>
            
            <div class="section">
                <h3>Test Types</h3>
                <ul class="list">
                    ${(data.test_types || []).map(test => `
                        <li class="tag">${test}</li>
                    `).join('')}
                </ul>
            </div>
            
            <div class="section">
                <h3>LOINC Codes</h3>
                <ul class="list">
                    ${loincArray.map(loinc => `
                        <li class="tag">
                            <span class="code">${loinc.code || loinc}</span>
                            <span class="details">${loinc.component ? `${loinc.component} in ${loinc.system}` : ''}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
            
            <div class="section">
                <h3>Keywords</h3>
                <ul class="list">
                    ${(data.keywords || []).map(keyword => `
                        <li class="tag">${keyword}</li>
                    `).join('')}
                </ul>
            </div>
        `;
    }
}

customElements.define('ontology-results', OntologyResults); 