import React, { useRef, useEffect, useState } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { MdScience, MdTerrain, MdHistoryEdu, MdCalculate, MdMenuBook, MdMusicNote, MdBrush, MdShare } from 'react-icons/md';

// Generate child-friendly educational text about an object from a subject perspective
async function getEducationalResources(objectName, subject) {
    const subjectNames = {
        biologia: "Biology",
        geologia: "Geology",
        historia: "History",
        matematicas: "Mathematics",
        lengua: "Language Arts",
        musica: "Music",
        artes: "Art"
    };

    const subj = subjectNames[subject] || subject;

    // If an OpenAI API key is provided via environment (REACT_APP_OPENAI_API_KEY),
    // attempt to generate child-friendly text with the Chat Completions API.
    // WARNING: Calling the OpenAI API directly from client-side code exposes the key
    // in the built bundle. Prefer a server-side proxy for production. This client-side
    // call is optional and falls back to a safe, local template generator on failure.
    const PROXY_BASE = process.env.REACT_APP_AI_PROXY_URL || (typeof window !== 'undefined' ? window.location.origin : '');

    const fallbackGenerator = () => {
        // Create short, simple paragraphs suitable for children (age ~6-12).
        const title = `${subj}: Getting to know ${objectName}`;
        const intro = `Let's discover what ${objectName} is and why it's interesting from the ${subj} perspective.`;

        let explanation = "";
        let funFacts = [];

        switch (subject) {
            case 'biologia':
                explanation = `${objectName} is part of nature. We can observe how it lives, what it eats, and how it grows. In biology we study its body, life cycle and habitat to understand how it interacts with other living things.`;
                funFacts = [
                    `Did you know observing ${objectName} can teach us about adaptation and survival?`,
                    `Try simple experiments to see how it reacts to light, water or food.`
                ];
                break;
            case 'geologia':
                explanation = `${objectName} can tell stories about the Earth. In geology we look at what it is made of, how it formed and what signs it leaves on the landscape.`;
                funFacts = [
                    `Sometimes ${objectName} is made from materials that formed millions of years ago.`,
                    `Looking at its shape and texture helps us understand processes like erosion or sedimentation.`
                ];
                break;
            case 'historia':
                explanation = `${objectName} can be a clue to the past. In history we investigate who used it, when and why. Objects help us imagine how people lived before.`;
                funFacts = [
                    `A simple object can reveal customs, technology or art from other times.`,
                    `Try asking: Who made it? What was it used for?`
                ];
                break;
            case 'matematicas':
                explanation = `From math we can measure ${objectName}, count parts, compare sizes and look for patterns. Numbers and shapes help us describe it precisely.`;
                funFacts = [
                    `You can measure its length, height or volume with rulers and measuring cups.`,
                    `Looking for patterns in ${objectName} (like repeated shapes) is a great logic exercise.`
                ];
                break;
            case 'lengua':
                explanation = `In language arts we can write a story or poem about ${objectName}. We can describe it using adjectives, comparisons and questions to practice expression.`;
                funFacts = [
                    `Try describing ${objectName} with five different adjectives.`,
                    `You can invent a story where ${objectName} is the main character.`
                ];
                break;
            case 'musica':
                explanation = `In music we can think about sounds that ${objectName} reminds us of. Maybe it has a rhythm or tone we can use to inspire a melody.`;
                funFacts = [
                    `Imagine which instrument would sound like ${objectName} and clap a rhythm.`,
                    `Try turning its name into a short song or chorus.`
                ];
                break;
            case 'artes':
                explanation = `In art we can draw, paint or sculpt ${objectName}. Look at its colors, textures and shapes to create a work inspired by it.`;
                funFacts = [
                    `Try drawing ${objectName} using only two colors.`,
                    `Try creating an abstract version focusing on its shapes.`
                ];
                break;
            default:
                explanation = `Let's observe ${objectName} and ask interesting questions: what is it, how does it work and why does it exist?`;
                funFacts = [`Ask curious questions and try to answer them with examples.`];
        }

        // Simple related-objects heuristics for the fallback path.
        const relatedMap = {
            tree: ['leaf', 'seed', 'bark'],
            car: ['wheel', 'tire', 'engine'],
            bottle: ['cap', 'label', 'liquid'],
            book: ['page', 'cover', 'bookmark'],
            dog: ['paw', 'tail', 'bone']
        };
        const key = objectName.toLowerCase();
        const relatedObjects = relatedMap[key] || [
            `small ${objectName}`,
            `parts of ${objectName}`
        ].slice(0, 3);

        return {
            title,
            text: intro,
            explanation,
            funFacts,
            relatedObjects
        };
    };

    // Try calling a local proxy (server) first. This keeps the OpenAI key on the server
    // and avoids exposing it in the client bundle. If the proxy is unavailable or returns
    // an error, fall back to the safe local generator.
    try {
        const proxyEndpoint = `${PROXY_BASE.replace(/\/$/, '')}/api/ai`;
        const resp = await fetch(proxyEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ objectName, subject: subj })
        });
        if (resp.ok) {
            const json = await resp.json();
                // Ensure we always provide relatedObjects for the UI.
                if (!json.relatedObjects || !Array.isArray(json.relatedObjects) || json.relatedObjects.length === 0) {
                    const relatedMap = {
                        tree: ['leaf', 'seed', 'bark'],
                        car: ['wheel', 'tire', 'engine'],
                        bottle: ['cap', 'label', 'liquid'],
                        book: ['page', 'cover', 'bookmark'],
                        dog: ['paw', 'tail', 'bone']
                    };
                    const key = String(objectName || '').toLowerCase();
                    json.relatedObjects = relatedMap[key] || [`small ${objectName}`, `parts of ${objectName}`].slice(0, 3);
                }
                try { console.debug('AI resources', json); } catch (e) {}
            if (json && json.title && json.text) {
                if (!Array.isArray(json.funFacts)) json.funFacts = json.funFacts ? [String(json.funFacts)] : [];
                return json;
            }
        } else {
            console.info('AI proxy not available or returned error, falling back to local templates', resp.status, resp.statusText);
        }
    } catch (err) {
        // network errors or CORS issues
        console.info('Could not reach AI proxy, using local templates', err && err.message ? err.message : err);
    }

    // Final fallback
    return fallbackGenerator();
}

const CameraScreen = () => {
    // Refs for video and canvas elements
    const videoBgRef = useRef(null);
    const videoCircleRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    // State management
    const [capturedImage, setCapturedImage] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [detectedObject, setDetectedObject] = useState(null);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [loadingDetection, setLoadingDetection] = useState(false);
    const [educationalResources, setEducationalResources] = useState(null);
    // Splash screen control (ensure visible for at least 3 seconds)
    const [showSplash, setShowSplash] = useState(true);
    useEffect(() => {
        const timer = setTimeout(() => setShowSplash(false), 3000);
        return () => clearTimeout(timer);
    }, []);

    // Store raw predictions from the detector in case we want to use them later (we only need the setter)
    const [, setPredictionsState] = useState([]);

    // Default subject list used for detected objects
    const defaultSubjects = [
        { key: "biologia", label: "Biology" },
        { key: "geologia", label: "Geology" },
        { key: "historia", label: "History" },
        { key: "matematicas", label: "Mathematics" },
        { key: "lengua", label: "Language Arts" },
        { key: "musica", label: "Music" },
        { key: "artes", label: "Art" }
    ];

    // Camera enable function
    const enableCamera = async () => {
        try {
            // Stop any existing stream and clear video elements to avoid interrupted plays
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                if (videoBgRef.current) videoBgRef.current.srcObject = null;
                if (videoCircleRef.current) videoCircleRef.current.srcObject = null;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false,
            });

            streamRef.current = stream;

            // Attach stream to videos and start playback. Some browsers may reject play() with
            // an AbortError if a load/play request is interrupted; catch and ignore that specific error.
            if (videoBgRef.current) {
                try {
                    videoBgRef.current.srcObject = stream;
                    await videoBgRef.current.play();
                } catch (playErr) {
                    if (playErr && (playErr.name === 'AbortError' || (playErr.message && playErr.message.indexOf('interrupted') !== -1))) {
                        console.warn('Video background play() was interrupted; continuing.', playErr.message || playErr);
                    } else {
                        throw playErr;
                    }
                }
            }

            if (videoCircleRef.current) {
                try {
                    videoCircleRef.current.srcObject = stream;
                    await videoCircleRef.current.play();
                } catch (playErr) {
                    if (playErr && (playErr.name === 'AbortError' || (playErr.message && playErr.message.indexOf('interrupted') !== -1))) {
                        console.warn('Video circle play() was interrupted; continuing.', playErr.message || playErr);
                    } else {
                        throw playErr;
                    }
                }
            }
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert("Could not access the camera.");
        }
    };

    // Initialize camera on component mount
    // Request fullscreen on mount
    useEffect(() => {
        const enterFullscreen = async () => {
            try {
                const elem = document.documentElement;
                if (elem.requestFullscreen) {
                    await elem.requestFullscreen();
                } else if (elem.webkitRequestFullscreen) {
                    await elem.webkitRequestFullscreen();
                } else if (elem.msRequestFullscreen) {
                    await elem.msRequestFullscreen();
                }
            } catch (err) {
                console.info('Fullscreen request declined or unsupported', err);
            }
        };
        enterFullscreen();
    }, []);

    // Initialize camera on component mount
    useEffect(() => {
        enableCamera();
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Handle photo capture
    const handleTakePhoto = async () => {
        const video = videoCircleRef.current;
        if (!video) return;
        
        const canvas = canvasRef.current;
        const size = Math.min(video.videoWidth, video.videoHeight);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        
        ctx.drawImage(
            video,
            (video.videoWidth - size) / 2,
            (video.videoHeight - size) / 2,
            size,
            size,
            0,
            0,
            size,
            size
        );

        const dataUrl = canvas.toDataURL("image/png");
        setCapturedImage(dataUrl);
        setLoadingDetection(true);
        setShowModal(true);

        try {
            const model = await cocoSsd.load();
            const img = new window.Image();
            img.src = dataUrl;
            img.onload = async () => {
                const predictions = await model.detect(img);
                if (predictions && predictions.length > 0) {
                    // Save raw predictions so we can offer alternatives later
                    setPredictionsState(predictions);
                    // Get object with highest confidence score
                    const mainObject = predictions.reduce((a, b) => (a.score > b.score ? a : b));
                    setDetectedObject({
                        title: mainObject.class.charAt(0).toUpperCase() + mainObject.class.slice(1),
                        description: `I detected a ${mainObject.class} in your image! Choose a subject to explore and learn more about it.`,
                        subjects: defaultSubjects
                    });
                } else {
                    setDetectedObject({
                        title: "Sin objeto detectado",
                        description: "No se ha podido identificar ningún objeto principal en la foto.",
                        subjects: []
                    });
                }
                setLoadingDetection(false);
            };
        } catch (e) {
            console.error('Error detecting objects:', e);
            setDetectedObject({
                title: "Error de detección",
                description: "No se pudo analizar la imagen.",
                subjects: []
            });
            setLoadingDetection(false);
        }
    };

    // Handle closing modal and resetting camera
    const handleClose = async () => {
        setShowModal(false);
        setSelectedSubject(null);
        setDetectedObject(null);
        setCapturedImage(null);
        setEducationalResources(null);
        setPredictionsState([]);
        await enableCamera();
    };



    // Share UI state and helper functions
    const [showShareOptions, setShowShareOptions] = useState(false);

    // Toast/snackbar for confirmations
    const [toastState, setToastState] = useState({ open: false, message: '', severity: 'success' });
    const showToast = (message, severity = 'success') => setToastState({ open: true, message, severity });
    const closeToast = (event, reason) => {
        if (reason === 'clickaway') return;
        setToastState(prev => ({ ...prev, open: false }));
    };

    const dataURLtoFile = (dataUrl, filename = 'curiocity-image.png') => {
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    };

    const handleDownloadImage = () => {
        if (!capturedImage) return;
        const a = document.createElement('a');
        a.href = capturedImage;
        a.download = 'curiocity-image.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('Image downloaded', 'success');
    };

    const shareContent = async () => {
        if (!educationalResources) return;
        const intro = 'Look what I found with <a href="https://curiocity-vn5n.onrender.com">Curiocity!</a>';
        const facts = (educationalResources.funFacts && educationalResources.funFacts.length > 0) ? ('\n\nFun facts:\n' + educationalResources.funFacts.map(f => '• ' + f).join('\n')) : '';
        const shareText = `${intro}\n\n${educationalResources.title}\n\n${educationalResources.text}\n\n${educationalResources.explanation || ''}${facts}`;

        try {
            // Try Web Share API with text only first (image+text combo often fails or drops text)
            if (navigator.share) {
                await navigator.share({ title: educationalResources.title, text: shareText });
                showToast('Shared successfully', 'success');
                return;
            }

            // Fallback to manual options UI (Email/WhatsApp handle text+image better)
            setShowShareOptions(true);
        } catch (err) {
            // User cancelled or share failed; show manual options
            console.info('Native share cancelled or unavailable, showing manual options', err && err.message ? err.message : '');
            setShowShareOptions(true);
        }
    };

    const shareViaEmail = () => {
        if (!educationalResources) return;
        const intro = 'Look what I found with Curiocity!';
        const subject = encodeURIComponent(`${educationalResources.title} — Curiocity`);
        let body = `${intro}\n\n${educationalResources.title}\n\n${educationalResources.text}\n\n${educationalResources.explanation || ''}`;
        if (educationalResources.funFacts && educationalResources.funFacts.length > 0) {
            body += `\n\nFun facts:\n${educationalResources.funFacts.map(f => '• ' + f).join('\n')}`;
        }
        // If the image is small enough, include base64; otherwise suggest download and attach manually
        if (capturedImage && capturedImage.length < 200000) {
            body += `\n\nImage (base64):\n${capturedImage}`;
        } else if (capturedImage) {
            body += `\n\n(Attach the image: use the "Download Image" button in the app)`;
        }
        const mailto = `mailto:?subject=${subject}&body=${encodeURIComponent(body)}`;
        window.open(mailto);
        showToast('Opened mail composer', 'info');
        setShowShareOptions(false);
    };

    const shareViaWhatsApp = () => {
        if (!educationalResources) return;
        const intro = 'Look what I found with Curiocity!';
        let text = `${intro}\n\n${educationalResources.title}\n\n${educationalResources.text}\n\n${educationalResources.explanation || ''}`;
        if (educationalResources.funFacts && educationalResources.funFacts.length > 0) {
            text += `\n\nFun facts:\n${educationalResources.funFacts.map(f => '• ' + f).join('\n')}`;
        }
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        showToast('Opened WhatsApp', 'info');
        setShowShareOptions(false);
    };

    // When a user taps a related object, behave as if a new picture was taken
    // with that object: show the detected-object view and allow subject selection.
    const handleRelatedObjectClick = (related) => {
        setDetectedObject({
            title: related.charAt(0).toUpperCase() + related.slice(1),
            description: `I detected a ${related} in your image! Choose a subject to explore and learn more about it.`,
            subjects: defaultSubjects
        });
        setSelectedSubject(null);
        setEducationalResources(null);
        setShowShareOptions(false);
        setShowModal(true);
    };

    


    return (
        <div style={{
            position: "relative",
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
            fontFamily: "'Sofia Sans', sans-serif"
        }}>
            {showSplash && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: '#faebd9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ background: '#ffffff', borderRadius: '50%', width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                            <img src="/curiocity-logo.svg" alt="Curiocity" style={{ width: 128, height: 128 }} />
                        </div>
                        
                        <p style={{ color: '#333', fontSize: 14, marginTop: 8 }}>Loading…</p>
                    </div>
                </div>
            )}
            {capturedImage ? (
                <>
                    <img
                        src={capturedImage}
                        alt="capturada"
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100vw",
                            height: "100vh",
                            objectFit: "cover",
                            zIndex: 20,
                            background: "#faebd9"
                        }}
                    />
                    <Drawer
                        anchor="bottom"
                        open={showModal}
                        onClose={handleClose}
                        PaperProps={{ style: { background: '#faebd9', borderTopLeftRadius: 24, borderTopRightRadius: 24, boxShadow: 'none' } }}
                    >
                        <Box sx={{
                            background: '#faebd9',
                            padding: 2,
                            px: 2,
                            pb: 3,
                            maxWidth: 'min(520px, 90vw)',
                            width: 'min(520px, 90vw)',
                            boxSizing: 'border-box',
                            mx: 'auto',
                            textAlign: 'center',
                            fontFamily: "'Sofia Sans', sans-serif",
                            position: 'relative',
                            maxHeight: '70vh',
                            overflowY: 'auto'
                        }}>
                                {selectedSubject ? (
                                    <>
                                        <div style={{ width: '100%', boxSizing: 'border-box', padding: '0 6px' }}>
                                            {educationalResources ? (
                                                <>
                                                    <div style={{ background: '#FFF6E0', borderRadius: 14, padding: 12, marginBottom: 12, textAlign: 'left' }}>
                                                        <h2 style={{ color: "#000000", fontWeight: 900, fontSize: 28, margin: "0 0 8px 0", maxWidth: '100%', wordBreak: 'break-word' }}>
                                                            ✨ {educationalResources.title}
                                                        </h2>
                                                        <p style={{ color: "#333", fontSize: 17, margin: "0 0 8px 0", maxWidth: '100%', wordBreak: 'break-word', fontWeight: 700 }}>
                                                            {educationalResources.text}
                                                        </p>
                                                    </div>

                                                    <div style={{ background: '#FFF0E6', borderRadius: 14, padding: 12, marginBottom: 12, textAlign: 'left' }}>
                                                        <p style={{ color: "#333", fontSize: 16, margin: 0, lineHeight: 1.5, maxWidth: '100%', wordBreak: 'break-word' }}>
                                                            {educationalResources.explanation}
                                                        </p>
                                                    </div>

                                                    {educationalResources.funFacts && educationalResources.funFacts.length > 0 && (
                                                        <div style={{ marginTop: 12, textAlign: 'left', background: '#FFF2E8', borderRadius: 14, padding: 12, marginBottom: 12 }}>
                                                            <h3 style={{ color: "#000000", fontSize: 20, marginBottom: 8 }}>Fun facts:</h3>
                                                            <ul style={{ paddingLeft: 20, color: '#333', fontSize: 15, lineHeight: 1.6, maxWidth: '100%', wordBreak: 'break-word' }}>
                                                                {educationalResources.funFacts.map((fact, i) => (
                                                                    <li key={i}>💡 {fact}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {educationalResources.links && educationalResources.links.length > 0 && (
                                                        <div style={{ marginTop: 12, textAlign: 'left', background: '#FFF8E6', borderRadius: 14, padding: 12, marginBottom: 12 }}>
                                                            <h3 style={{ color: "#000000", fontSize: 20, marginBottom: 8 }}>Recommended resources:</h3>
                                                            <ul style={{ paddingLeft: 20, color: '#333', fontSize: 15, lineHeight: 1.6, maxWidth: '100%', wordBreak: 'break-word' }}>
                                                                {educationalResources.links.map((link, i) => (
                                                                    <li key={i}>
                                                                        <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0b63d6', wordBreak: 'break-word' }}>
                                                                            {link.title || link.url}
                                                                        </a>
                                                                        {link.source ? ` — ${link.source}` : null}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {educationalResources.relatedObjects && educationalResources.relatedObjects.length > 0 && (
                                                        <div style={{ marginTop: 12, textAlign: 'left', background: '#FFF5E6', borderRadius: 14, padding: 12, marginBottom: 12 }}>
                                                            <h3 style={{ color: "#000000", fontSize: 20, marginBottom: 8 }}>Related objects:</h3>
                                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                                {educationalResources.relatedObjects.map((ro, i) => (
                                                                    <button key={i} onClick={() => handleRelatedObjectClick(ro)} style={{
                                                                        fontFamily: "'Sofia Sans', sans-serif",
                                                                        background: "#000000",
                                                                        color: "#faebd9",
                                                                        border: "none",
                                                                        borderRadius: 14,
                                                                        padding: "8px 12px",
                                                                        fontWeight: 700,
                                                                        fontSize: 14,
                                                                        cursor: "pointer",
                                                                        margin: 2
                                                                    }}>{ro}</button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Share controls: allow sharing the AI text and the captured image via Web Share, Email or WhatsApp */}
                                                    <div style={{ marginTop: 16, textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                                                            <button
                                                                onClick={shareContent}
                                                                style={{
                                                                    fontFamily: "'Sofia Sans', sans-serif",
                                                                    background: "#000000",
                                                                    color: "#faebd9",
                                                                    border: "none",
                                                                    borderRadius: 14,
                                                                    padding: "10px 14px",
                                                                    fontWeight: 700,
                                                                    fontSize: 15,
                                                                    cursor: "pointer",
                                                                    margin: 2,
                                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 8
                                                                }}
                                                            ><MdShare style={{ fontSize: 18, color: '#faebd9' }} />Share</button>

                                                            {/* Download hidden per request */}
                                                            <button
                                                                onClick={handleDownloadImage}
                                                                style={{ display: 'none' }}
                                                            >Download Image</button>
                                                        </div>

                                                        {showShareOptions && (
                                                            <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', background: 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 12 }}>
                                                                <button
                                                                    onClick={shareViaEmail}
                                                                    style={{
                                                                        fontFamily: "'Sofia Sans', sans-serif",
                                                                        background: "#0b63d6",
                                                                        color: "#fff",
                                                                        border: "none",
                                                                        borderRadius: 12,
                                                                        padding: "8px 12px",
                                                                        fontWeight: 700,
                                                                        fontSize: 14,
                                                                        cursor: "pointer",
                                                                        margin: 2
                                                                    }}
                                                                >📧 Email</button>

                                                                <button
                                                                    onClick={shareViaWhatsApp}
                                                                    style={{
                                                                        fontFamily: "'Sofia Sans', sans-serif",
                                                                        background: "#25D366",
                                                                        color: "#fff",
                                                                        border: "none",
                                                                        borderRadius: 12,
                                                                        padding: "8px 12px",
                                                                        fontWeight: 700,
                                                                        fontSize: 14,
                                                                        cursor: "pointer",
                                                                        margin: 2
                                                                    }}
                                                                >💬 WhatsApp</button>

                                                                <button
                                                                    onClick={handleDownloadImage}
                                                                    style={{
                                                                        fontFamily: "'Sofia Sans', sans-serif",
                                                                        background: "#ff9500",
                                                                        color: "#fff",
                                                                        border: "none",
                                                                        borderRadius: 12,
                                                                        padding: "8px 12px",
                                                                        fontWeight: 700,
                                                                        fontSize: 14,
                                                                        cursor: "pointer",
                                                                        margin: 2
                                                                    }}
                                                                >📥 Download Image</button>

                                                                <button
                                                                    onClick={() => setShowShareOptions(false)}
                                                                    style={{
                                                                        fontFamily: "'Sofia Sans', sans-serif",
                                                                        background: "#fff",
                                                                        color: "#000000",
                                                                        border: "2px solid #000000",
                                                                        borderRadius: 12,
                                                                        padding: "8px 12px",
                                                                        fontWeight: 700,
                                                                        fontSize: 14,
                                                                        cursor: "pointer",
                                                                        margin: 2
                                                                    }}
                                                                >Close</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <p style={{ color: "#000000", fontSize: 20, maxWidth: '100%', wordBreak: 'break-word' }}>Loading educational content...</p>
                                            )}

                                            {/* Connect with more subjects — only show after educational content is loaded */}
                                            {educationalResources && (
                                                <div style={{ marginTop: 18, textAlign: 'left' }}>
                                                    <h3 style={{ color: "#000000", fontSize: 20, marginBottom: 16 }}>Connect with more subjects:</h3>
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 12 }}>
                                                        {(detectedObject && detectedObject.subjects ? detectedObject.subjects : defaultSubjects).map(subj => {
                                                            const icons = {
                                                                biologia: MdScience,
                                                                geologia: MdTerrain,
                                                                historia: MdHistoryEdu,
                                                                matematicas: MdCalculate,
                                                                lengua: MdMenuBook,
                                                                musica: MdMusicNote,
                                                                artes: MdBrush
                                                            };
                                                            const Icon = icons[subj.key] || null;
                                                            return (
                                                                <button key={subj.key}
                                                                    style={{
                                                                        fontFamily: "'Sofia Sans', sans-serif",
                                                                        background: "#000000",
                                                                        color: "#faebd9",
                                                                        border: "none",
                                                                        borderRadius: 14,
                                                                        padding: "8px 12px",
                                                                        fontWeight: 700,
                                                                        fontSize: 15,
                                                                        cursor: "pointer",
                                                                        margin: 2,
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: 8
                                                                    }}
                                                                    onClick={async () => {
                                                                        setSelectedSubject(subj.key);
                                                                        const resources = await getEducationalResources(detectedObject ? detectedObject.title : '', subj.key);
                                                                        setEducationalResources(resources);
                                                                    }}
                                                                >
                                                                    {Icon ? <Icon style={{ fontSize: 18, color: '#faebd9' }} /> : null}
                                                                    <span style={{ display: 'inline-block' }}>{subj.label}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {loadingDetection || !detectedObject ? (
                                                            <p style={{ color: "#000000", fontSize: 20 }}>Loading educational content...</p>
                                        ) : (
                                            <>
                                                <h2 style={{ color: "#000000", fontWeight: 800, fontSize: 32, margin: 0 }}>
                                                    {detectedObject.title}
                                                </h2>
                                                <p style={{ color: "#333", fontSize: 18, margin: "16px 0 24px 0", maxWidth: '100%', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                                    {detectedObject.description}
                                                </p>

                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 }}>
                                                    {detectedObject.subjects.map(subj => {
                                                        const icons = {
                                                            biologia: MdScience,
                                                            geologia: MdTerrain,
                                                            historia: MdHistoryEdu,
                                                            matematicas: MdCalculate,
                                                            lengua: MdMenuBook,
                                                            musica: MdMusicNote,
                                                            artes: MdBrush
                                                        };
                                                        const Icon = icons[subj.key] || null;
                                                        return (
                                                            <button
                                                                key={subj.key}
                                                                style={{
                                                                    fontFamily: "'Sofia Sans', sans-serif",
                                                                    background: "#000000",
                                                                    color: "#faebd9",
                                                                    border: "none",
                                                                    borderRadius: 14,
                                                                    padding: "8px 12px",
                                                                    fontWeight: 700,
                                                                    fontSize: 15,
                                                                    cursor: "pointer",
                                                                    margin: 2,
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 8
                                                                }}
                                                                onClick={async () => {
                                                                    setSelectedSubject(subj.key);
                                                                    const resources = await getEducationalResources(detectedObject.title, subj.key);
                                                                    setEducationalResources(resources);
                                                                }}
                                                            >
                                                                {Icon ? <Icon style={{ fontSize: 18, color: '#faebd9' }} /> : null}
                                                                <span style={{ display: 'inline-block' }}>{subj.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <button
                                                    onClick={handleClose}
                                                    style={{
                                                        fontFamily: "'Sofia Sans', sans-serif",
                                                        background: "#fff",
                                                        color: "#000000",
                                                        border: "2px solid #000000",
                                                        borderRadius: 16,
                                                        padding: "8px 20px",
                                                        fontWeight: 700,
                                                        fontSize: 16,
                                                        cursor: "pointer",
                                                        marginTop: 8
                                                    }}
                                                >Incorrect object</button>
                                            </>
                                        )}
                                    </>
                                )}
                            </Box>
                    </Drawer>

                    {/* Snackbar / toast for share and other feedback */}
                    <Snackbar open={toastState.open} autoHideDuration={3000} onClose={closeToast} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                        <Alert onClose={closeToast} severity={toastState.severity} sx={{ width: '100%' }}>
                            {toastState.message}
                        </Alert>
                    </Snackbar>

                </>
            ) : (
                <>
                    <video
                        ref={videoBgRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100vw",
                            height: "100vh",
                            objectFit: "cover",
                            filter: "blur(8px)"
                        }}
                    />


                    {/* Círculo nítido */}
                    <div style={{
                        position: "absolute",
                        top: "44%",
                        left: "50%",
                        width: "56vw",
                        height: "56vw",
                        maxWidth: "72vh",
                        maxHeight: "72vh",
                        transform: "translate(-50%, -50%)",
                        borderRadius: "50%",
                        overflow: "hidden",
                        pointerEvents: "none",
                        border: "2px solid #faebd9",
                        //boxShadow: "0 0 32px 4px #bfa98a, 0 0 0 12px #faebd9"
                    }}>
                        <video
                            ref={videoCircleRef}
                            autoPlay
                            playsInline
                            muted
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                filter: "none"
                            }}
                        />
                    </div>

                    {/* Decorative question marks removed per UI update */}

                    {/* Botón disparador */}
                    <div style={{
                        position: "absolute",
                        bottom: "6vh",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 90,
                        height: 90,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                        zIndex: 10,
                        border: "2px solid #faebd9"
                    }}>
                        <button
                            style={{
                                width: 80,
                                height: 80,
                                borderRadius: "50%",
                                background: "#faebd9",
                                border: "0px",
                                outline: "none",
                                cursor: "pointer",
                                fontFamily: "'Sofia Sans', sans-serif",
                                zIndex: 11,
                                pointerEvents: "auto",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                            }}
                            aria-label="Tomar foto"
                            onClick={handleTakePhoto}
                        >
                            <img src="/curiocity-icon.svg" alt="" aria-hidden="true" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                        </button>
                    </div>
                </>
            )}
            {/* Canvas oculto para capturar la imagen */}
            <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
    );
};

export default CameraScreen;
