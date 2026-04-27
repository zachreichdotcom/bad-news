document.addEventListener('DOMContentLoaded', () => {
    let history =[];
    let currentStep = -1;
    let draggingEl = null;
    let offset = { x: 0, y: 0 };
    let isLassoing = false;
    let topZIndex = 5000; 

    document.addEventListener('click', (e) => {
        if (e.target.closest('a')) e.preventDefault();
    });
    window.addEventListener('dragstart', (e) => e.preventDefault());
    window.addEventListener('blur', releaseDrag);
    document.addEventListener('mouseleave', releaseDrag);

    function releaseDrag() {
        if (draggingEl) {
            draggingEl.classList.remove('is-dragging');
            draggingEl = null;
        }
    }

    // --- AUTOMATICALLY SUBDIVIDE DIVIDING LINES ---
    function convertBordersToLines() {
        const elements = Array.from(document.body.getElementsByTagName('*'));
        
        for (let el of elements) {
            if (el.hasAttribute('data-remix-ignore') || el.closest('[data-remix-ignore="true"]')) continue;
            
            // Only scan structural blocks that typically hold NYT's CSS grid lines
            if (!['DIV', 'SECTION', 'ARTICLE', 'UL', 'OL', 'LI', 'MAIN', 'HR'].includes(el.tagName)) continue;

            const comp = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;

            // Extract Top Border
            const topW = parseFloat(comp.borderTopWidth);
            if (topW > 0 && comp.borderTopStyle !== 'none' && comp.borderTopColor !== 'rgba(0, 0, 0, 0)' && comp.borderTopColor !== 'transparent') {
                const line = document.createElement('div');
                line.className = 'draggable-line is-extracted';
                line.style.position = 'absolute';
                line.style.width = rect.width + 'px'; line.style.height = topW + 'px';
                line.style.backgroundColor = comp.borderTopColor;
                line.style.left = (rect.left + window.scrollX) + 'px'; line.style.top = (rect.top + window.scrollY) + 'px';
                document.body.appendChild(line);
                el.style.borderTopColor = 'transparent'; // Prevent layout shifts by keeping the invisible border
            }
            
            // Extract Bottom Border
            const botW = parseFloat(comp.borderBottomWidth);
            if (botW > 0 && comp.borderBottomStyle !== 'none' && comp.borderBottomColor !== 'rgba(0, 0, 0, 0)' && comp.borderBottomColor !== 'transparent') {
                const line = document.createElement('div');
                line.className = 'draggable-line is-extracted';
                line.style.position = 'absolute';
                line.style.width = rect.width + 'px'; line.style.height = botW + 'px';
                line.style.backgroundColor = comp.borderBottomColor;
                line.style.left = (rect.left + window.scrollX) + 'px'; line.style.top = (rect.bottom - botW + window.scrollY) + 'px';
                document.body.appendChild(line);
                el.style.borderBottomColor = 'transparent';
            }

            // Extract Right Border (vertical dividers)
            const rightW = parseFloat(comp.borderRightWidth);
            if (rightW > 0 && comp.borderRightStyle !== 'none' && comp.borderRightColor !== 'rgba(0, 0, 0, 0)' && comp.borderRightColor !== 'transparent') {
                const line = document.createElement('div');
                line.className = 'draggable-line is-extracted';
                line.style.position = 'absolute';
                line.style.height = rect.height + 'px'; line.style.width = rightW + 'px';
                line.style.backgroundColor = comp.borderRightColor;
                line.style.left = (rect.right - rightW + window.scrollX) + 'px'; line.style.top = (rect.top + window.scrollY) + 'px';
                document.body.appendChild(line);
                el.style.borderRightColor = 'transparent';
            }
        }
    }

    // --- STATE MANAGEMENT ---
    function saveState() {
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll('.ephemeral-lasso').forEach(el => el.remove());
        clone.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
        
        const origCanvases = document.body.querySelectorAll('canvas');
        const cloneCanvases = clone.querySelectorAll('canvas');
        for (let i = 0; i < origCanvases.length; i++) {
            if (origCanvases[i].classList.contains('ephemeral-lasso')) continue;
            try {
                const img = document.createElement('img');
                img.src = origCanvases[i].toDataURL('image/png');
                img.className = origCanvases[i].className;
                img.style.cssText = origCanvases[i].style.cssText;
                cloneCanvases[i].parentNode.replaceChild(img, cloneCanvases[i]);
            } catch(e) {}
        }
        
        const state = clone.innerHTML;
        if (currentStep < history.length - 1) history = history.slice(0, currentStep + 1);
        history.push(state);
        currentStep++;
    }

    function restoreState(stateHTML) {
        const temp = document.createElement('html');
        temp.innerHTML = stateHTML;
        
        Array.from(document.body.children).forEach(child => {
            if (child.tagName !== 'SCRIPT' && !child.hasAttribute('data-remix-ignore') && !child.closest('[data-remix-ignore="true"]')) child.remove();
        });

        Array.from(temp.querySelector('body').children).forEach(child => {
            if (child.tagName !== 'SCRIPT' && !child.hasAttribute('data-remix-ignore') && !child.closest('[data-remix-ignore="true"]')) document.body.appendChild(child);
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.metaKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            if (currentStep > 0) { currentStep--; restoreState(history[currentStep]); }
        }
        if (e.metaKey && e.shiftKey && e.key === 'z') {
            e.preventDefault();
            if (currentStep < history.length - 1) { currentStep++; restoreState(history[currentStep]); }
        }
    });

    // Run subdivider and save initial state
    setTimeout(() => {
        convertBordersToLines();
        saveState();
    }, 1000); 

    function isImmovableHeader(el) {
        return el.hasAttribute('data-remix-ignore') || el.closest('[data-remix-ignore="true"]');
    }

    function getPreservedStyles(el) {
        if (el.nodeType !== 1) el = el.parentNode;
        const comp = window.getComputedStyle(el);
        return `font-family: ${comp.fontFamily}; font-size: ${comp.fontSize}; font-weight: ${comp.fontWeight}; color: ${comp.color}; line-height: ${comp.lineHeight}; letter-spacing: ${comp.letterSpacing}; text-transform: ${comp.textTransform}; font-style: ${comp.fontStyle};`;
    }

    function extractElement(target) {
        if (target.classList.contains('is-extracted')) return target;
        saveState(); 
        if (target.parentElement) target.parentElement.style.background = 'transparent';

        const comp = window.getComputedStyle(target);
        const rect = target.getBoundingClientRect();
        
        // Bake the inherited styles directly into the object so it never loses color/fonts
        const savedStyles = {
            color: comp.color, fontFamily: comp.fontFamily, fontSize: comp.fontSize, 
            fontWeight: comp.fontWeight, lineHeight: comp.lineHeight, 
            letterSpacing: comp.letterSpacing, textTransform: comp.textTransform
        };

        const ghost = target.cloneNode(true);
        ghost.style.visibility = 'hidden'; 
        ghost.style.opacity = '0';
        ghost.style.pointerEvents = 'none'; 
        target.parentNode.insertBefore(ghost, target);

        target.style.width = rect.width + 'px';
        target.style.height = rect.height + 'px';
        target.style.left = (rect.left + window.scrollX) + 'px';
        target.style.top = (rect.top + window.scrollY) + 'px';
        target.style.position = 'absolute';
        target.style.margin = '0';
        
        Object.assign(target.style, savedStyles); // Apply baked styles

        target.classList.add('is-extracted');
        document.body.appendChild(target);
        return target;
    }

    // --- DRAGGING LOGIC ---
    document.addEventListener('mousedown', (e) => {
        if (isLassoing || e.button !== 0 || isImmovableHeader(e.target)) return;
        e.preventDefault(); 

        let target = e.target;
        if (['BODY', 'HTML', 'MAIN'].includes(target.tagName)) return;

        // Strict Whitelist: Prevents massive layout grids from being grabbed
        if (!target.classList.contains('is-extracted') && !target.classList.contains('draggable-word') && !target.classList.contains('draggable-letter')) {
            const blockElement = target.closest('p, h1, h2, h3, h4, h5, h6, img, video, picture, figure, canvas, time, a, span, li, button, svg, hr');
            if (!blockElement) return; // If they click on empty grid space, do nothing.
            target = blockElement;
        }

        target = extractElement(target);
        target.style.zIndex = ++topZIndex;
        
        draggingEl = target;
        draggingEl.classList.add('is-dragging');
        const rect = draggingEl.getBoundingClientRect();
        offset.x = e.clientX - rect.left;
        offset.y = e.clientY - rect.top;
    });

    window.addEventListener('mousemove', (e) => {
        if (!draggingEl) return;
        draggingEl.style.left = (e.clientX - offset.x + window.scrollX) + 'px';
        draggingEl.style.top = (e.clientY - offset.y + window.scrollY) + 'px';
    });

    window.addEventListener('mouseup', releaseDrag);

    // --- DOUBLE CLICK LOGIC ---
    document.addEventListener('dblclick', (e) => {
        if (isImmovableHeader(e.target)) return;
        let target = e.target;

        // 1. IMAGE/VIDEO LASSO
        if (['IMG', 'VIDEO', 'PICTURE', 'CANVAS'].includes(target.tagName) || target.classList.contains('lasso-cutout')) {
            if (draggingEl) releaseDrag();
            let sourceEl = target.tagName === 'PICTURE' ? (target.querySelector('img') || target) : target;
            const rect = target.getBoundingClientRect();
            
            if (target.tagName !== 'CANVAS') {
                const canvasTarget = document.createElement('canvas');
                canvasTarget.width = rect.width; canvasTarget.height = rect.height;
                const ctx = canvasTarget.getContext('2d');
                try { ctx.drawImage(sourceEl, 0, 0, rect.width, rect.height); } catch(err) {} 
                canvasTarget.style.cssText = target.style.cssText;
                canvasTarget.className = target.className;
                target.parentNode.replaceChild(canvasTarget, target);
                target = canvasTarget;
            }
            startLasso(target);
            return;
        }

        // 2. WORD TO LETTERS
        if (target.classList.contains('draggable-word')) {
            saveState();
            const text = target.innerText;
            const preciseStyles = getPreservedStyles(target);
            target.innerHTML = '';
            target.style.whiteSpace = 'nowrap'; 
            text.split('').forEach(char => {
                const span = document.createElement('span');
                span.className = 'draggable-letter';
                span.style.cssText = preciseStyles;
                span.innerHTML = char === ' ' ? '&nbsp;' : char;
                target.appendChild(span);
            });
            target.classList.remove('draggable-word');
            return;
        }

        // 3. TEXT BLOCK TO WORDS
        const splitTags =['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'SPAN', 'A', 'STRONG', 'EM', 'CITE', 'TIME'];
        if (splitTags.includes(target.tagName) && !target.classList.contains('draggable-letter') && !target.classList.contains('draggable-word')) {
            saveState();
            const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, null, false);
            const textNodes =[];
            while(walker.nextNode()) textNodes.push(walker.currentNode);

            textNodes.forEach(node => {
                if (node.nodeValue.trim() === '') return;
                const nodeStyles = getPreservedStyles(node.parentNode);
                const words = node.nodeValue.split(/(\s+)/); 
                const fragment = document.createDocumentFragment();
                words.forEach(word => {
                    if (word.trim() === '') {
                        fragment.appendChild(document.createTextNode(word)); 
                    } else {
                        const span = document.createElement('span');
                        span.className = 'draggable-word'; span.style.cssText = nodeStyles;
                        span.innerText = word;
                        fragment.appendChild(span);
                    }
                });
                node.parentNode.replaceChild(fragment, node);
            });
            window.getSelection().removeAllRanges();
        }
    });

    // --- LASSO TOOL LOGIC ---
    function startLasso(canvasElement) {
        saveState();
        isLassoing = true;
        let lassoPoints =[]; let isDrawing = false;

        const overlay = document.createElement('canvas');
        overlay.classList.add('ephemeral-lasso');
        const rect = canvasElement.getBoundingClientRect();
        
        overlay.width = rect.width; overlay.height = rect.height;
        overlay.style.left = canvasElement.style.left || (rect.left + window.scrollX) + 'px';
        overlay.style.top = canvasElement.style.top || (rect.top + window.scrollY) + 'px';
        overlay.style.backgroundColor = 'rgba(255,255,255,0.3)';
        document.body.appendChild(overlay);

        const ctx = overlay.getContext('2d');

        function onMouseDown(e) {
            isDrawing = true;
            const canvasRect = overlay.getBoundingClientRect();
            lassoPoints.push({ x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top });
        }

        function onMouseMove(e) {
            if (!isDrawing) return;
            const canvasRect = overlay.getBoundingClientRect();
            lassoPoints.push({ x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top });
            ctx.clearRect(0, 0, overlay.width, overlay.height);
            ctx.beginPath(); ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
            for(let i = 1; i < lassoPoints.length; i++) ctx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
            ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.stroke();
        }

        function onMouseUp() {
            if (!isDrawing) {
                overlay.remove(); isLassoing = false;
                overlay.removeEventListener('mousedown', onMouseDown);
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                return;
            }
            isDrawing = false;
            
            if (lassoPoints.length > 5) {
                let minX = Math.min(...lassoPoints.map(p => p.x)); let maxX = Math.max(...lassoPoints.map(p => p.x));
                let minY = Math.min(...lassoPoints.map(p => p.y)); let maxY = Math.max(...lassoPoints.map(p => p.y));

                const cutout = document.createElement('canvas');
                cutout.width = maxX - minX; cutout.height = maxY - minY;
                const cCtx = cutout.getContext('2d');

                cCtx.beginPath(); cCtx.moveTo(lassoPoints[0].x - minX, lassoPoints[0].y - minY);
                for(let i = 1; i < lassoPoints.length; i++) cCtx.lineTo(lassoPoints[i].x - minX, lassoPoints[i].y - minY);
                cCtx.closePath(); cCtx.clip();
                cCtx.drawImage(canvasElement, -minX, -minY, overlay.width, overlay.height);

                cutout.className = 'lasso-cutout is-extracted';
                cutout.style.left = (parseFloat(overlay.style.left) + minX) + 'px';
                cutout.style.top = (parseFloat(overlay.style.top) + minY) + 'px';
                cutout.style.zIndex = ++topZIndex; 
                document.body.appendChild(cutout);

                const origCtx = canvasElement.getContext('2d');
                origCtx.save(); origCtx.globalCompositeOperation = 'destination-out';
                origCtx.beginPath(); origCtx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
                for(let i = 1; i < lassoPoints.length; i++) origCtx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
                origCtx.closePath(); origCtx.fill(); origCtx.restore();
            }

            overlay.remove(); isLassoing = false;
            overlay.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        }

        overlay.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }
});