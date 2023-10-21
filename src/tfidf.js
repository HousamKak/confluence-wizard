class TFIDF {
    constructor() {
        this.documents = [];
        this.termFrequency = {};
        this.inverseDocumentFrequency = {};
    }

    addDocument(doc) {
        const preprocessedDoc = this.preprocess(doc);
        this.documents.push(preprocessedDoc);

        const termCounts = {};
        preprocessedDoc.forEach(term => {
            termCounts[term] = (termCounts[term] || 0) + 1;
        });

        for (const term in termCounts) {
            this.termFrequency[term] = this.termFrequency[term] || [];
            this.termFrequency[term].push(termCounts[term]);
        }
    }

    preprocess(doc) {
        // Convert to lowercase
        doc = doc.toLowerCase();

        // Simple whitespace-based tokenization
        let terms = doc.split(/\s+/);

        // Remove stopwords (this is a basic list, consider expanding)
        const stopwords = ["and", "the", "is", "of", "to", "in", "that", "it", "with", "as"];
        terms = terms.filter(term => !stopwords.includes(term));

        // TODO: Add stemming and lemmatization if necessary

        return terms;
    }

    computeIDF() {
        const totalDocs = this.documents.length;
        for (const term in this.termFrequency) {
            const termPresenceInDocs = this.termFrequency[term].length;
            // Smoothing added to the formula
            this.inverseDocumentFrequency[term] = Math.log(totalDocs / (1 + termPresenceInDocs));
        }
    }

    tfidf(doc) {
        const preprocessedDoc = this.preprocess(doc);
        const termCounts = {};

        preprocessedDoc.forEach(term => {
            termCounts[term] = (termCounts[term] || 0) + 1;
        });

        const tfidfVector = {};
        for (const term in termCounts) {
            // Sublinear scaling for term frequency
            const tf = 1 + Math.log(termCounts[term]);
            const idf = this.inverseDocumentFrequency[term] || 0;
            tfidfVector[term] = tf * idf;
        }

        // Document Length Normalization
        const magnitude = Math.sqrt(Object.values(tfidfVector).reduce((sum, val) => sum + val * val, 0));
        for (const term in tfidfVector) {
            tfidfVector[term] = tfidfVector[term] / magnitude;
        }

        return tfidfVector;
    }

    tfidfs(doc, callback) {
        const docVector = this.tfidf(doc);
        this.documents.forEach((_, index) => {
            const comparisonVector = this.tfidf(this.documents[index].join(' '));
            const cosineSimilarity = this.computeCosineSimilarity(docVector, comparisonVector);
            callback(index, cosineSimilarity);
        });
    }

    computeCosineSimilarity(vecA, vecB) {
        const terms = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
        let dotProduct = 0, magnitudeA = 0, magnitudeB = 0;

        terms.forEach(term => {
            const valA = vecA[term] || 0;
            const valB = vecB[term] || 0;
            dotProduct += valA * valB;
            magnitudeA += valA * valA;
            magnitudeB += valB * valB;
        });

        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0;
        }

        return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
    }
}


export default TFIDF;