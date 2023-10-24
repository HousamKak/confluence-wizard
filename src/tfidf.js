import _ from 'underscore';

class SimpleTokenizer {
    constructor(language) {
        this.language = language;
    }

    tokenize(text, lowercase = true) {
        if (lowercase) {
            text = text.toLowerCase();
        }
        return text.split(/\W+/).filter(Boolean);
    }
}

// Instantiate the tokenizer
const tokenizer = new SimpleTokenizer('en');

import stopwords_en from './stopwords-en';
const stopwords = stopwords_en;

function buildDocument(text, key) {
    var stopOut;

    if (typeof text === 'string') {
        text = tokenizer.tokenize(text);
        stopOut = true;
    } else if (!_.isArray(text)) {
        stopOut = false;
        return text;
    }

    return text.reduce(function(document, term) {
        if (typeof document[term] === 'function') document[term] = 0;
        if (!stopOut || stopwords.indexOf(term) < 0)
            document[term] = (document[term] ? document[term] + 1 : 1);
        return document;
    }, {
        __key: key
    });
}

function tf(term, document) {
    return document[term] ? document[term] : 0;
}

function documentHasTerm(term, document) {
    return document[term] && document[term] > 0;
}

function TfIdf() {
    this.documents = [];
    this._idfCache = {};
}

export default TfIdf;
TfIdf.tf = tf;

TfIdf.prototype.idf = function(term, force) {
    if (this._idfCache[term] && this._idfCache.hasOwnProperty(term) && !force)
        return this._idfCache[term];

    var docsWithTerm = this.documents.reduce(function(count, document) {
        return count + (documentHasTerm(term, document) ? 1 : 0);
    }, 0);

    var idf = 1 + Math.log((this.documents.length) / (1 + docsWithTerm));

    this._idfCache[term] = idf;
    return idf;
};

TfIdf.prototype.addDocument = function(document, key, restoreCache) {
    this.documents.push(buildDocument(document, key));

    // Update or clear the cache based on the restoreCache parameter
    if (restoreCache === true) {
        for (var term in this._idfCache) {
            this.idf(term, true);
        }
    } else {
        this._idfCache = {};
    }
};


TfIdf.prototype.tfidf = function(terms, d) {
    var _this = this;

    if (!_.isArray(terms))
        terms = terms.split(/\s+/).map(token => token.toLowerCase());

    return terms.reduce(function(value, term) {
        var idf = _this.idf(term);
        idf = idf === Infinity ? 0 : idf;
        return value + (tf(term, _this.documents[d]) * idf);
    }, 0.0);
};

TfIdf.prototype.listTerms = function(d) {
    var terms = [];

    for (var term in this.documents[d]) {
        if (term != '__key')
            terms.push({
                term: term,
                tfidf: this.tfidf(term, d)
            });
    }

    return terms.sort(function(x, y) {
        return y.tfidf - x.tfidf;
    });
};

TfIdf.prototype.tfidfs = function(terms, callback) {
    var tfidfs = new Array(this.documents.length);

    for (var i = 0; i < this.documents.length; i++) {
        tfidfs[i] = this.tfidf(terms, i);
        if (callback)
            callback(i, tfidfs[i], this.documents[i].__key);
    }

    return tfidfs;
};

TfIdf.prototype.setTokenizer = function(t) {
    if (!_.isFunction(t.tokenize))
        throw new Error('Expected a valid Tokenizer');
    tokenizer = t;
};

TfIdf.prototype.serialize = function() {
    return JSON.stringify({
        documents: this.documents,
        _idfCache: this._idfCache
    });
};

TfIdf.deserialize = function(serializedData) {
    const data = JSON.parse(serializedData);
    const instance = new TfIdf();
    instance.documents = data.documents || [];
    instance._idfCache = data._idfCache || {};
    return instance;
};
