const disableShuffle = true;
const disableRotate = true;
const rotateTimeMin = 10000;
const rotateTimeVariance = 25000;
const specials = {
    fohocars: {
        scrollAnim: undefined,
        shown: function() { 
            const div = document.getElementById('fohocars');
            const end = document.getElementById('fohoscrollend');
            if(this.scrollAnim) { $(end).velocity('stop'); div.scrollTo(0, 0); this.scrollAnim = undefined; }
            this.scrollAnim = $(end).velocity('scroll', { duration: 36500, easing: 'linear', container: div }, { complete: () => { console.log('finished');  } });
        },
        hidden: function() { }
    }
};

// Utility functions 
function shuffleArray(a) {
    if(!disableShuffle && Array.isArray(a) && a.length > 1) { 
        for(let i = 0; i < a.length - 1; i++) {                        
            var j = Math.floor((a.length - i) * Math.random()) + i;
            if(i != j) {
                const x = a[j];
                a[j] = a[i];
                a[i] = x;
            }
        }
    }
    return a;
}

function loadImage(img) { 
    if(!img.src && img.dataset.src) { img.src = img.dataset.src; } 
}
function loadVideo(video) {
    loadImage(video);
    video.querySelectorAll('source').forEach(loadImage);
    video.load();
}
function loadLazy(elem) {
    if(elem.nodeName === 'IMG') { return loadImage(elem); }
    else if(elem.nodeName === 'VIDEO') { return loadVideo(elem); }
}

function revealSpoiler(el) { el.classList.add('revealed'); }

// Stolen from Stack.  Obviously, the ziggurat method is much faster, but for 
// what I'm using it for, we can do a few trig functions.
function random_normal(saturate, skew) {
    let num;

    // Generate a normal variate
    if(this.cachedValue !== undefined) {
        // If we previously calculated an R and Theta, re-use them
        num = this.cachedValue.r * Math.sin(this.cachedValue.theta);
        this.cachedValue = undefined;
    } else {
        let u, v;
        // Don't allow 0
        do { u = Math.random(); } while(u == 0); 
        do { v = Math.random(); } while(v == 0); 
        const r = Math.sqrt(-2.0 * Math.log(u));
        const theta = 2.0 * Math.PI * v;
        this.cachedValue = { r: r, theta: theta };
        num = r * Math.cos(theta);
    }

    // Compress the 3.6 standard deviations range into [0,1)
    num = num / 10.0 + 0.5; 
    if (num < 0 || num >= 1) {
        // If the result's out of that [0,1) range, either saturate it or retry
        // until we get a correct result
        if(saturate) { 
            if(num < 0) { 
                return 0; 
            } else if(num >= 1) {
                return 1 - Number.EPSILON;
            }
        } else {
            // Just retry until we get an in-range result
            return this(saturate, skew);
        }
    }

    // Skew, if requested
    if(skew) { num = Math.pow(num, skew); }

    return num;
}

// Steal Java's string hashcode
String.prototype.hashCode = function() {
    let hash = 0;
    for(let i = 0; i < this.length; i++) {
        hash = ((hash << 5) - hash) + this.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

// Boxart image rotation.  Click boxart images to force an immediate rotation.
// Some boxarts are special, and have their own manual rotation timings.  Joke boxarts only appear for 2 seconds,
// while the Spiderpan one appears for 30 seconds (because that's how long the animation plays)
function setupRotate(groupidx, groupelem) {
    const $groupelem = $(groupelem);
    const boxarts = $groupelem.find('.boxart').toArray();
    // Pick an initial box art
    let shownIdx = 0;
    boxarts.forEach((elem, idx) => {
        // Move the first one to the front, others to the back
        if(idx == shownIdx) { 
            elem.classList.add('front');
            elem.style.opacity = 1;
            // This is unnecessarily safe, but who knows?
            loadLazy(elem);
            // If the first boxart is a video, start it playing
            if(elem.nodeName === 'VIDEO') { elem.currentTime = 0; elem.play(); }

        } else {
            elem.classList.remove('front');
            elem.style.opacity = 0;
        }
    });
    // Shuffle remaining indices
    let shuffle = shuffleArray(Array.from(boxarts.keys()).slice(1));
    // Lazy-load the next one
    loadLazy(boxarts[shuffle[0]]);

    // Configure animation
    let animating = false;
    let again = false;
    let timeoutId = undefined;
    let overrideDuration = undefined;
    const cycleAnim = async function() {
        // Don't do anything if we're already animating
        if(animating) { again = true; return; }
        animating = true;
        // Cancel any active timeouts
        if(timeoutId) { clearTimeout(timeoutId); timeoutId = undefined; }
        // Reshuffle indices if we've used 'em all
        while(shuffle.length == 0 || shuffle[0] == shownIdx) { shuffle = shuffleArray(Array.from(boxarts.keys())); }

        // Determine next item idx
        let nextIdx = $groupelem.data('forcedBoxart');
        if(typeof nextIdx !== "number") { nextIdx = shuffle.shift(); }
        // Ensure the following image is loaded
        if(shuffle.length > 0) { loadLazy(boxarts[shuffle[0]]); }
        if(nextIdx === shownIdx) {
            // Skip animation
            animating = false;
        } else {
            // Move next boxart to front
            boxarts[nextIdx].classList.add('front');
            boxarts[shownIdx].classList.remove('front');
            // Enable animation if this is an animated image
            if(boxarts[nextIdx].dataset.anim) { boxarts[nextIdx].classList.add(boxarts[nextIdx].dataset.anim); }
            // Play video if this is a video
            if(boxarts[nextIdx].nodeName === 'VIDEO') { boxarts[nextIdx].currentTime = 0; boxarts[nextIdx].play(); }
            // SPECIAL CASES:
            if(boxarts[nextIdx].classList.contains('watcherboxart')) {
                groupelem.classList.add('watcheroverride');
            }
            overrideDuration = undefined;
            // Joke boxarts only show for a short time
            if(boxarts[nextIdx].classList.contains('joke')) {
                overrideDuration = 2400;
            }

            if(boxarts[nextIdx].dataset.linkedfade) { 
                $.Velocity.animate(document.querySelectorAll(boxarts[nextIdx].dataset.linkedfade), { opacity: 1 }, { duration: 1500 });
            }
            if(boxarts[shownIdx].dataset.linkedfade) { 
                $.Velocity.animate(document.querySelectorAll(boxarts[shownIdx].dataset.linkedfade), { opacity: 0 }, { duration: 1500 });
            }

            if(boxarts[nextIdx].dataset.special && boxarts[nextIdx].dataset.special in specials) { 
                specials[boxarts[nextIdx].dataset.special].shown();
            }
            if(boxarts[shownIdx].dataset.special && boxarts[shownIdx].dataset.special in specials) { 
                specials[boxarts[shownIdx].dataset.special].hidden();
            }

            await Promise.all([
                $.Velocity.animate(boxarts[shownIdx], { opacity: 0 }, { duration: 1500 }),
                $.Velocity.animate(boxarts[nextIdx], { opacity: 1 }, { duration: 1500 })
            ]).then(() => {
                if(boxarts[shownIdx].classList.contains('watcherboxart')) {
                    groupelem.classList.remove('watcheroverride');
                }
                if(boxarts[shownIdx].dataset.anim) { boxarts[shownIdx].classList.remove(boxarts[shownIdx].dataset.anim); }
        
                shownIdx = nextIdx;
                animating = false;
            });
        }
        
        // Immediately repeat?
        if(again) { again = false; cycleAnim(); return; }
        // Start next timeout (special case shorter delay for long galleries)
        const delay = boxarts.length < 20 ? (rotateTimeMin + Math.random() * rotateTimeVariance) : (5000 + Math.random() * 10000);
        if(!disableRotate) { timeoutId = setTimeout(cycleAnim, overrideDuration || delay); }
    };

    $groupelem.on('click', cycleAnim);
    $groupelem.data('cycleAnim', cycleAnim);
    const delay = boxarts.length < 20 ? (10000 + Math.random() * 25000) : (5000 + Math.random() * 10000);
    if(!disableRotate) { timeoutId = setTimeout(cycleAnim, delay); }

    // Start cycling when element appears
    // $groupelem.appear();
    // $groupelem.one('appear', function() {
    //     if(!timeoutId) {
    //         const delay = boxarts.length < 20 ? (10000 + Math.random() * 25000) : (5000 + Math.random() * 10000);
    //         if(!disableRotate) { timeoutId = setTimeout(cycleAnim, delay); }
    //         //$groupelem.find('img[data-src]').each((imgidx, img) => { img.src = img.dataset.src; });
    //     }
    // });
    // Allow click to cycle manually
}

// Some titles rotate when you hold your mouse over them for 6 seconds.  
// Look for elements with a "hiddentitle" class
function setupTitleJoke(groupidx, groupelem) {
    // Wrap group elem and get child nodes
    groupelem = $(groupelem);
    const children = groupelem.children().toArray().map(x => $(x));
    if(children.length <= 1) { return; }

    // Set up rotater
    let currentIdx = 0;
    let animating = false;
    let mouseIn = false;
    let timeoutId = undefined;
    const rotateTitle = function() {
        if(animating) { return; } else { animating = true; }

        // Get next index
        let nextIdx = currentIdx + 1;
        if(nextIdx == children.length) { nextIdx = 0; }

        // Crossfade titles
        return Promise.all([
            $.Velocity.animate(children[currentIdx], {'opacity': 0.0} ),
            $.Velocity.animate(children[nextIdx], {'opacity': 1.0} )
        ]).then(() => {
            currentIdx = nextIdx;
            animating = false;
            if(mouseIn) { timeoutId = setTimeout(rotateTitle, currentIdx == 0 ? 5000 : 3000); }
        });
    }

    const resetTitle = () => {
        groupelem.children().finish();
        groupelem.children().css('opacity', 0.0);
        children[0].css('opacity', 1.0);
        currentIdx = 0;
        animating = false;
        if(timeoutId) { clearTimeout(timeoutId); timeoutId = undefined;}
    }

    // Set up event trigger
    groupelem.mouseenter(function() {
        mouseIn = true;
        // Reset everything
        resetTitle();
        timeoutId = setTimeout(rotateTitle, 5000);
    });
    groupelem.mouseleave(function() {
        mouseIn = false;
        resetTitle();
    });
}

function setupRunnerReviews(game) {
    const reviewRow = Array.from(document.querySelectorAll('.runnerReviews')).find(x => x.dataset.for === game.dataset.title);
    const showReviewsLink = game.querySelector('.showReviewsLink');
    if(!reviewRow || !showReviewsLink) { return; }

    let previousText = 'Hide Reviews';
    showReviewsLink.addEventListener('click', () => {
        const text = showReviewsLink.textContent;
        showReviewsLink.textContent = previousText;
        previousText = text;
        reviewRow.classList.toggle('reviewsShown');
        game.classList.toggle('reviewsShown');
        $(reviewRow).fadeToggle();
    });
    showReviewsLink.addEventListener('click', () => {
        reviewRow.querySelectorAll('[data-avatar-url]').forEach(el => {
            el.style.setProperty('--review-avatar', `url(${el.dataset.avatarUrl})`);
        });
    }, { once: true });
}

function setupGotyReviews(game) {
    const reviewRow = document.querySelector(`#gotys .reviews[data-for="${game.dataset.rank}"]`);
    const showReviewsLink = game.querySelector('.showReviewsLink');
    if(!reviewRow || !showReviewsLink) { return; }

    let previousText = 'Hide Reviews';
    showReviewsLink.addEventListener('click', () => {
        const text = showReviewsLink.textContent;
        showReviewsLink.textContent = previousText;
        previousText = text;
        const lol = $(reviewRow).slideToggle();
        if(game.dataset.rank == '1') { 
            lol.promise().then(() => { game.classList.toggle('twirlGoat'); });
        }
    });
    showReviewsLink.addEventListener('click', () => {
        reviewRow.querySelectorAll('[data-avatar-url]').forEach(el => {
            el.style.setProperty('--review-avatar', `url(${el.dataset.avatarUrl})`);
        });
    }, { once: true, passive: true });
}

var showReview = false;
function init() {
    // Set up boxart rotating
    $('.runnerimg').each(setupRotate);
    $('.gotyimg').each(setupRotate);
    // Set up title jokes
    $('.gotytitle').each(setupTitleJoke);
    $('.runnertitle').each(setupTitleJoke);

    // Set up Special Considerations section
    const $special = $('#special');
    $special.isotope({
        masonry: { columnWidth: 'div.item:not(.showReview)' },
        itemSelector: 'div.item',
        sortBy: 'original-order',
        sortAscending: true,
        transitionDuration: '0.8s',
        filter: function() { return !this.classList.contains('reviews') || this.classList.contains('showReview'); }
    });

    // Set up Honourable Mentions section 
    $('#honourable').isotope({
        masonry: { columnWidth: 'div.item:not(.showReview)' },
        itemSelector: 'div.item',
        sortBy: 'original-order',
        sortAscending: true,
        transitionDuration: '0.8s',
        filter: function() { return !this.classList.contains('reviews') || this.classList.contains('showReview'); }
    });

    // Set up Runner reviews
    $('#runners > .runnerReviews').fadeOut();
    document.querySelectorAll('#runners > .runner').forEach(setupRunnerReviews);

    // Set up GOTY reviews
    $('#gotys .reviews').slideUp();
    document.querySelectorAll('#gotys > .goty').forEach(setupGotyReviews);

    // Set up review toggles for Honourable Mentions and Special Considerations
    document.querySelectorAll('#honourable > .item[data-reviews], #special > .item[data-reviews]').forEach(el => {
        el.addEventListener('click', () => {
            el.parentElement.querySelectorAll(`.reviews[data-for="${el.dataset.title}"] [data-avatar-url]`).forEach(av => {
                av.style.setProperty('--review-avatar', `url(${av.dataset.avatarUrl})`);
            });
        }, { once: true, passive: true });
    });
    $('#honourable > .item[data-reviews]').click((ev) => { 
        ev.delegateTarget.classList.toggle('showReview');
        document.querySelector(`#honourable > .reviews[data-for="${ev.delegateTarget.dataset.title}"]`).classList.toggle('showReview');
        $('#honourable').isotope();
    });
    $('#special > .item[data-reviews]').click((ev) => { 
        ev.delegateTarget.classList.toggle('showReview');
        document.querySelector(`#special > .reviews[data-for="${ev.delegateTarget.dataset.title}"]`).classList.toggle('showReview');
        $('#special').isotope();
    });

    // Set up spoiler formatting
    document.querySelectorAll('span.spoiler').forEach(el => el.addEventListener('click', ev => revealSpoiler(el), { once: true, passive: true }));
}

let triggerInitPromise;
const initPromise = new Promise(res => { triggerInitPromise = res; });

$(document).ready(async function() {
    // Fix chrome underlines
    if(navigator.appVersion.indexOf("Chrome/") != -1) { document.documentElement.style.setProperty('--deco-override', 'underline'); }
    // Fix that Safari mondosucks
    // const hasWebpAnimSupport = new Promise(res => Modernizr.on('webpanimation', res));
    // const hasWebpSupport = new Promise(res => Modernizr.on('webp', res));
    
    // console.log(`WebP Support: ${await hasWebpSupport} | WebP Animation Support: ${await hasWebpAnimSupport}`);
    // if(!(await hasWebpSupport && await hasWebpAnimSupport)) { 
    //     console.log('Swapping WebPs for PNGs...');
    //     const webptopng = /boxart\/webp\/([^\.]+)\.webp/;
    //     document.querySelectorAll('[src$=".webp"]').forEach(x => x.src = x.src.replace(webptopng, 'boxart/$1.png'));
    //     document.querySelectorAll('[data-src$=".webp"]').forEach(x => x.dataset.src = x.dataset.src.replace(webptopng, 'boxart/$1.png'));
    // }
    init();
    triggerInitPromise();
    triggerInitPromise = () => {};
    //$.force_appear();
});

(function() {
    let loaded = false;

    const handler = async () => {
        loaded = true;
        console.log('load event');
        await triggerInitPromise;
        console.log('init done');
        // Setup fade to hide the slides
        setTimeout(() => $('#mainContainer > *:first-child').animate({opacity: 1}, 1000), 50);
        // Display page
        setTimeout(() => {
            // Hide review carousels
            //$('#runners > .reviewRow > .reviewCell').slick('setPosition');
            //$('#gotys > .reviewRow > .gotyReviews').slick('setPosition');
            // document.querySelectorAll('#runners > .reviewRow > .reviewCell').forEach(el => tns({ container: el, controls: false, mouseDrag: true }));
            // document.querySelectorAll('#gotys > .reviewRow > .gotyReviews').forEach(el => tns({ container: el, items: 2, controls: false, mouseDrag: true }));
            // $('#runners > .reviewRow, #gotys .gotyReviews').each((idx, el) => $(el).css('display', 'none'));

            // Display page
            $('<div style="opacity:0"></div>').animate({
                opacity: 1
            } , { 
                duration:1000, 
                step: (val) => document.documentElement.style.setProperty('--initial-opacity', val)
            });
        }, 1000);
    };

    window.addEventListener('load', handler, false);
    if(document.readyState === 'complete') { handler(); }
}());