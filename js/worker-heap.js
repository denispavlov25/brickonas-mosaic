/**
 * Heap data structure for Web Worker.
 * Adapted from heap.js - removed module shims, iterator, and _defineProperty.
 * Core logic unchanged.
 */

var toInt = function(n) { return ~~n; };

class Heap {
    constructor(compare) {
        if (compare === undefined) compare = Heap.minComparator;
        this.heapArray = [];
        this._limit = 0;
        this.compare = compare;
        this._invertedCompare = function(a, b) {
            return -1 * this.compare(a, b);
        }.bind(this);
    }

    static getChildrenIndexOf(idx) {
        return [idx * 2 + 1, idx * 2 + 2];
    }

    static getParentIndexOf(idx) {
        if (idx <= 0) return -1;
        var whichChildren = idx % 2 ? 1 : 2;
        return Math.floor((idx - whichChildren) / 2);
    }

    static getSiblingIndexOf(idx) {
        if (idx <= 0) return -1;
        var whichChildren = idx % 2 ? 1 : -1;
        return idx + whichChildren;
    }

    static minComparator(a, b) {
        if (a > b) return 1;
        else if (a < b) return -1;
        else return 0;
    }

    static maxComparator(a, b) {
        if (b > a) return 1;
        else if (b < a) return -1;
        else return 0;
    }

    static minComparatorNumber(a, b) { return a - b; }
    static maxComparatorNumber(a, b) { return b - a; }
    static defaultIsEqual(a, b) { return a === b; }

    static heapify(arr, compare) {
        var heap = new Heap(compare);
        heap.heapArray = arr;
        heap.init();
        return heap;
    }

    static heappop(heapArr, compare) {
        var heap = new Heap(compare);
        heap.heapArray = heapArr;
        return heap.pop();
    }

    static heappush(heapArr, item, compare) {
        var heap = new Heap(compare);
        heap.heapArray = heapArr;
        heap.push(item);
    }

    add(element) {
        this._sortNodeUp(this.heapArray.push(element) - 1);
        this._applyLimit();
        return true;
    }

    addAll(elements) {
        var i = this.length;
        this.heapArray.push.apply(this.heapArray, elements);
        for (var l = this.length; i < l; ++i) {
            this._sortNodeUp(i);
        }
        this._applyLimit();
        return true;
    }

    bottom(n) {
        if (n === undefined) n = 1;
        if (this.heapArray.length === 0 || n <= 0) return [];
        else if (this.heapArray.length === 1) return [this.heapArray[0]];
        else if (n >= this.heapArray.length) return this.heapArray.slice();
        else return this._bottomN_push(~~n);
    }

    clear() { this.heapArray = []; }

    clone() {
        var cloned = new Heap(this.comparator());
        cloned.heapArray = this.toArray();
        cloned._limit = this._limit;
        return cloned;
    }

    comparator() { return this.compare; }

    contains(o, fn) {
        if (fn === undefined) fn = Heap.defaultIsEqual;
        return this.heapArray.findIndex(function(el) { return fn(el, o); }) >= 0;
    }

    init(array) {
        if (array) this.heapArray = array.slice();
        for (var i = Math.floor(this.heapArray.length); i >= 0; --i) {
            this._sortNodeDown(i);
        }
        this._applyLimit();
    }

    isEmpty() { return this.length === 0; }

    get length() { return this.heapArray.length; }

    get limit() { return this._limit; }
    set limit(_l) {
        this._limit = ~~_l;
        this._applyLimit();
    }

    peek() { return this.heapArray[0]; }

    pop() {
        var last = this.heapArray.pop();
        if (this.length > 0 && last !== undefined) {
            return this.replace(last);
        }
        return last;
    }

    push() {
        var elements = Array.prototype.slice.call(arguments);
        if (elements.length < 1) return false;
        else if (elements.length === 1) return this.add(elements[0]);
        else return this.addAll(elements);
    }

    pushpop(element) {
        if (this.compare(this.heapArray[0], element) < 0) {
            var tmp = this.heapArray[0];
            this.heapArray[0] = element;
            element = tmp;
            this._sortNodeDown(0);
        }
        return element;
    }

    remove(o, fn) {
        if (fn === undefined) fn = Heap.defaultIsEqual;
        if (this.length > 0) {
            if (o === undefined) {
                this.pop();
                return true;
            } else {
                var idx = this.heapArray.findIndex(function(el) { return fn(el, o); });
                if (idx >= 0) {
                    if (idx === 0) this.pop();
                    else if (idx === this.length - 1) this.heapArray.pop();
                    else {
                        this.heapArray.splice(idx, 1, this.heapArray.pop());
                        this._sortNodeUp(idx);
                        this._sortNodeDown(idx);
                    }
                    return true;
                }
            }
        }
        return false;
    }

    replace(element) {
        var peek = this.heapArray[0];
        this.heapArray[0] = element;
        this._sortNodeDown(0);
        return peek;
    }

    size() { return this.length; }

    top(n) {
        if (n === undefined) n = 1;
        if (this.heapArray.length === 0 || n <= 0) return [];
        else if (this.heapArray.length === 1 || n === 1) return [this.heapArray[0]];
        else if (n >= this.heapArray.length) return this.heapArray.slice();
        else return this._topN_push(~~n);
    }

    toArray() { return this.heapArray.slice(); }
    toString() { return this.heapArray.toString(); }
    get(i) { return this.heapArray[i]; }

    getChildrenOf(idx) {
        return Heap.getChildrenIndexOf(idx)
            .map(function(i) { return this.heapArray[i]; }.bind(this))
            .filter(function(e) { return e !== undefined; });
    }

    getParentOf(idx) {
        var pi = Heap.getParentIndexOf(idx);
        return this.heapArray[pi];
    }

    _applyLimit() {
        if (this._limit && this._limit < this.heapArray.length) {
            var rm = this.heapArray.length - this._limit;
            while (rm) { this.heapArray.pop(); --rm; }
        }
    }

    _bottomN_push(n) {
        var bottomHeap = new Heap(this.compare);
        bottomHeap.limit = n;
        bottomHeap.heapArray = this.heapArray.slice(-n);
        bottomHeap.init();
        var startAt = this.heapArray.length - 1 - n;
        var parentStartAt = Heap.getParentIndexOf(startAt);
        var indices = [];
        for (var i = startAt; i > parentStartAt; --i) indices.push(i);
        var arr = this.heapArray;
        while (indices.length) {
            var idx = indices.shift();
            if (this.compare(arr[idx], bottomHeap.peek()) > 0) {
                bottomHeap.replace(arr[idx]);
                if (idx % 2) indices.push(Heap.getParentIndexOf(idx));
            }
        }
        return bottomHeap.toArray();
    }

    _moveNode(j, k) {
        var tmp = this.heapArray[j];
        this.heapArray[j] = this.heapArray[k];
        this.heapArray[k] = tmp;
    }

    _sortNodeDown(i) {
        var moveIt = i < this.heapArray.length - 1;
        var self = this.heapArray[i];
        var that = this;
        var getPotentialParent = function(best, j) {
            if (that.heapArray.length > j && that.compare(that.heapArray[j], that.heapArray[best]) < 0) {
                best = j;
            }
            return best;
        };
        while (moveIt) {
            var childrenIdx = Heap.getChildrenIndexOf(i);
            var bestChildIndex = childrenIdx.reduce(getPotentialParent, childrenIdx[0]);
            var bestChild = this.heapArray[bestChildIndex];
            if (typeof bestChild !== "undefined" && this.compare(self, bestChild) > 0) {
                this._moveNode(i, bestChildIndex);
                i = bestChildIndex;
            } else {
                moveIt = false;
            }
        }
    }

    _sortNodeUp(i) {
        var moveIt = i > 0;
        while (moveIt) {
            var pi = Heap.getParentIndexOf(i);
            if (pi >= 0 && this.compare(this.heapArray[pi], this.heapArray[i]) > 0) {
                this._moveNode(i, pi);
                i = pi;
            } else {
                moveIt = false;
            }
        }
    }

    _topN_push(n) {
        var topHeap = new Heap(this._invertedCompare);
        topHeap.limit = n;
        var indices = [0];
        var arr = this.heapArray;
        while (indices.length) {
            var i = indices.shift();
            if (i < arr.length) {
                if (topHeap.length < n) {
                    topHeap.push(arr[i]);
                    var children = Heap.getChildrenIndexOf(i);
                    indices.push(children[0], children[1]);
                } else if (this.compare(arr[i], topHeap.peek()) < 0) {
                    topHeap.replace(arr[i]);
                    var ch = Heap.getChildrenIndexOf(i);
                    indices.push(ch[0], ch[1]);
                }
            }
        }
        return topHeap.toArray();
    }
}
