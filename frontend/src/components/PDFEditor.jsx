// import { useMemo, useState, useRef, useEffect } from "react";
// import { PDFDocument, rgb, StandardFonts, degrees, BlendMode } from "pdf-lib";
// import fontkit from "@pdf-lib/fontkit";
// import axios from "axios";
// import PDFViewer from "./PDFViewer";
// import Toolbar from "./Toolbar";
// import "./PDFEditor.css";

// function PDFEditor({ token, onLogout, currentUser }) {
//   const [pdfFile, setPdfFile] = useState(null);
//   const [showProfileMenu, setShowProfileMenu] = useState(false);
//   const [recentDocs, setRecentDocs] = useState([]);
//   const profileMenuRef = useRef(null);

//   // Close profile menu when clicking outside
//   useEffect(() => {
//     const handleClickOutside = (event) => {
//       if (
//         profileMenuRef.current &&
//         !profileMenuRef.current.contains(event.target)
//       ) {
//         setShowProfileMenu(false);
//       }
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => {
//       document.removeEventListener("mousedown", handleClickOutside);
//     };
//   }, []);

//   const [pdfDoc, setPdfDoc] = useState(null);
//   const [docId, setDocId] = useState(null);
//   const [embeddedSigning, setEmbeddedSigning] = useState(false);
//   const [uploadingPdf, setUploadingPdf] = useState(false);
//   const [loadingPdf, setLoadingPdf] = useState(false);
//   const [currentPage, setCurrentPage] = useState(1);
//   const [totalPages, setTotalPages] = useState(0);
//   const [gitEnabled, setGitEnabled] = useState(false);
//   const [gitSignatureOk, setGitSignatureOk] = useState(null);
//   const [editMode, setEditMode] = useState(null);
//   const [textContent, setTextContent] = useState("");
//   const [fontSize, setFontSize] = useState(16);
//   // Use a stable "font key" (mapped to CSS + PDF fonts)
//   const [fontFamily, setFontFamily] = useState("helvetica");
//   const [textBoxes, setTextBoxes] = useState([]); // Active text boxes on canvas
//   const [imageBoxes, setImageBoxes] = useState([]); // Active image boxes on canvas
//   const [textSelections, setTextSelections] = useState([]); // Text selections for highlighting
//   const [rectangleBoxes, setRectangleBoxes] = useState([]); // Editable rectangle overlays
//   const [circleBoxes, setCircleBoxes] = useState([]); // Editable circle/ellipse overlays
//   const [lineBoxes, setLineBoxes] = useState([]); // Editable line overlays
//   const [undoStack, setUndoStack] = useState([]);
//   const fileInputRef = useRef(null);
//   const [selectedTextId, setSelectedTextId] = useState(null);
//   const [selectedRectangleId, setSelectedRectangleId] = useState(null);
//   const [selectedCircleId, setSelectedCircleId] = useState(null);
//   const [selectedLineId, setSelectedLineId] = useState(null);
//   const imageInputRef = useRef(null);
//   const [autoFocusTextBoxId, setAutoFocusTextBoxId] = useState(null);
//   const fontBytesCacheRef = useRef(new Map());
//   const ocrCacheRef = useRef(new Map());
//   const applyingTextHighlightRef = useRef(false);

//   // Multiply keeps black pixels black while tinting light pixels yellow.
//   const TEXT_HIGHLIGHT_OPACITY = 1.0;
//   const TEXT_HIGHLIGHT_BLEND_MODE = BlendMode.Multiply;

//   // Conversion feature states
//   const [convertPdfFile, setConvertPdfFile] = useState(null);
//   const [convertImageFiles, setConvertImageFiles] = useState([]);
//   const [mergePdfFiles, setMergePdfFiles] = useState([]);
//   const [pptFile, setPptFile] = useState(null);
//   const [lockPdfFile, setLockPdfFile] = useState(null);
//   const [lockPassword, setLockPassword] = useState("");
//   const [unlockPdfFile, setUnlockPdfFile] = useState(null);
//   const [unlockPassword, setUnlockPassword] = useState("");
//   const [watermarkPdfFile, setWatermarkPdfFile] = useState(null);
//   const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
//   const [converting, setConverting] = useState(false);
//   const convertPdfInputRef = useRef(null);
//   const convertImageInputRef = useRef(null);
//   const mergePdfInputRef = useRef(null);
//   const pptInputRef = useRef(null);
//   const lockPdfInputRef = useRef(null);
//   const unlockPdfInputRef = useRef(null);
//   const watermarkPdfInputRef = useRef(null);

//   // Signing states
//   const [signingPdfFile, setSigningPdfFile] = useState(null);
//   const [signingMode, setSigningMode] = useState(false);
//   const [drawingMode, setDrawingMode] = useState(false);
//   const [drawingCanvas, setDrawingCanvas] = useState(null);
//   const [showNameModal, setShowNameModal] = useState(false);
//   const [signatureName, setSignatureName] = useState("");
//   const [pageSizes, setPageSizes] = useState([]);
//   const signPdfInputRef = useRef(null);
//   const drawingCanvasRef = useRef(null);

//   useEffect(() => {
//     if (drawingMode && drawingCanvasRef.current) {
//       const canvas = drawingCanvasRef.current;
//       const ctx = canvas.getContext("2d");
//       ctx.strokeStyle = "#000000";
//       ctx.lineWidth = 2;
//       ctx.lineCap = "round";
//       ctx.lineJoin = "round";
//     }
//   }, [drawingMode]);

//   const api = useMemo(() => {
//     const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
//     return axios.create({
//       baseURL: `${API_URL}/api`,
//       headers: token ? { Authorization: `Bearer ${token}` } : {},
//     });
//   }, [token]);

//   const getApiErrorMessage = async (error, fallback) => {
//     try {
//       const data = error?.response?.data;
//       if (!data) return fallback;

//       // If axios was configured with responseType: 'blob', error payload will be a Blob.
//       if (typeof Blob !== "undefined" && data instanceof Blob) {
//         const text = await data.text().catch(() => "");
//         if (!text) return fallback;
//         try {
//           const json = JSON.parse(text);
//           return json?.error || fallback;
//         } catch {
//           return text;
//         }
//       }

//       if (typeof data === "string") return data;
//       return data?.error || fallback;
//     } catch {
//       return fallback;
//     }
//   };

//   const fetchRecentDocs = async () => {
//     try {
//       const res = await api.get("/documents");
//       const docs = res.data.documents || [];

//       // Removed the grouping by name so all edits to the same or different files
//       // are visible, limited to the 5 most recent items. They are ordered by recently updated by the backend.
//       setRecentDocs(docs.slice(0, 5));
//     } catch (e) {
//       console.error("Failed to fetch recent docs", e);
//     }
//   };

//   const handleSignPdfSelect = async (event) => {
//     const file = event.target.files[0];
//     if (!file) return;

//     setSigningPdfFile(file);
//     setSigningMode(true);
//     setLoadingPdf(true);

//     try {
//       const arrayBuffer = await file.arrayBuffer();
//       const pdfDoc = await PDFDocument.load(arrayBuffer);
//       setPdfDoc(pdfDoc);
//       setPdfFile(URL.createObjectURL(file));
//       setTotalPages(pdfDoc.getPageCount());
//       setCurrentPage(1);
//       // Get page sizes
//       const sizes = [];
//       for (let i = 0; i < pdfDoc.getPageCount(); i++) {
//         const page = pdfDoc.getPage(i);
//         const { width, height } = page.getSize();
//         sizes.push({ width, height });
//       }
//       setPageSizes(sizes);
//       // Reset boxes for signing
//       setTextBoxes([]);
//       setImageBoxes([]);
//       setRectangleBoxes([]);
//       setCircleBoxes([]);
//       setLineBoxes([]);
//       setTextSelections([]);
//       setUndoStack([]);
//       setEditMode(null);
//     } catch (error) {
//       console.error("Error loading PDF for signing:", error);
//       alert("Error loading PDF for signing");
//     } finally {
//       setLoadingPdf(false);
//     }
//   };

//   useEffect(() => {
//     fetchRecentDocs();
//   }, [token]);

//   useEffect(() => {
//     const id = api.interceptors.response.use(
//       (resp) => resp,
//       (err) => {
//         const status = err?.response?.status;
//         if (status === 401) {
//           alert("Session expired or invalid. Please login again.");
//           if (onLogout) onLogout();
//         }
//         return Promise.reject(err);
//       },
//     );
//     return () => api.interceptors.response.eject(id);
//   }, [api, onLogout]);

//   // Load document from URL param
//   useEffect(() => {
//     const params = new URLSearchParams(window.location.search);
//     const docIdParam = params.get("doc");
//     if (docIdParam && !pdfFile) {
//       const loadDoc = async () => {
//         try {
//           setLoadingPdf(true);
//           const downloadRes = await api.get(
//             `/documents/${docIdParam}/download`,
//             { responseType: "arraybuffer" },
//           );
//           const bytes = downloadRes.data;
//           const blob = new Blob([bytes], { type: "application/pdf" });
//           const arrayBuffer = await blob.arrayBuffer();
//           const pdf = await PDFDocument.load(arrayBuffer);

//           setDocId(docIdParam);
//           setPdfDoc(pdf);
//           const newUrl = URL.createObjectURL(blob);
//           setPdfFile(newUrl);
//           setTotalPages(pdf.getPageCount());
//           setCurrentPage(1);
//         } catch (err) {
//           console.error(err);
//           alert(
//             "Failed to load document. Note: Only the document creator can view this PDF.",
//           );
//         } finally {
//           setLoadingPdf(false);
//         }
//       };
//       loadDoc();
//     }
//   }, [api, pdfFile]);

//   // Fetch embedded PDF Git status for the current doc
//   useEffect(() => {
//     let cancelled = false;
//     const run = async () => {
//       if (!docId) {
//         setGitEnabled(false);
//         setGitSignatureOk(null);
//         return;
//       }
//       try {
//         const res = await api.get(`/documents/${docId}/git`);
//         if (cancelled) return;
//         const enabled = !!res.data?.enabled;
//         setGitEnabled(enabled);
//         if (!enabled) {
//           setGitSignatureOk(null);
//         } else {
//           const sigOk = res.data?.signature?.ok;
//           setGitSignatureOk(typeof sigOk === "boolean" ? sigOk : null);
//         }
//       } catch {
//         if (cancelled) return;
//         setGitEnabled(false);
//         setGitSignatureOk(null);
//       }
//     };
//     run();
//     return () => {
//       cancelled = true;
//     };
//   }, [api, docId]);

//   useEffect(() => {
//     ocrCacheRef.current.clear();
//   }, [docId]);

//   const fetchOcrForPage = async (pageNumber) => {
//     if (!docId) return null;
//     const key = `${docId}:${pageNumber}`;
//     if (ocrCacheRef.current.has(key)) return ocrCacheRef.current.get(key);
//     const res = await api.get(`/documents/${docId}/ocr`, {
//       params: { page: pageNumber },
//     });
//     ocrCacheRef.current.set(key, res.data);
//     return res.data;
//   };

//   // Deselect overlays when clicking outside boxes + toolbars
//   useEffect(() => {
//     if (
//       selectedTextId == null &&
//       selectedRectangleId == null &&
//       selectedCircleId == null &&
//       selectedLineId == null
//     ) {
//       return;
//     }

//     const handleGlobalMouseDown = (e) => {
//       const el =
//         e.target instanceof Element ? e.target : e.target?.parentElement;
//       if (!el) return;

//       // Keep selection when interacting with text boxes or toolbars
//       if (
//         el.closest(".text-box") ||
//         el.closest(".rect-box") ||
//         el.closest(".circle-box") ||
//         el.closest(".line-box") ||
//         el.closest(".secondary-toolbar") ||
//         el.closest(".toolbar")
//       ) {
//         return;
//       }

//       setSelectedTextId(null);
//       setSelectedRectangleId(null);
//       setSelectedCircleId(null);
//       setSelectedLineId(null);
//     };

//     document.addEventListener("mousedown", handleGlobalMouseDown);
//     return () =>
//       document.removeEventListener("mousedown", handleGlobalMouseDown);
//   }, [selectedTextId, selectedRectangleId, selectedCircleId, selectedLineId]);

//   const handleFileUpload = async (event) => {
//     const file = event.target.files[0];
//     try {
//       const name = String(file?.name || "").toLowerCase();
//       const type = String(file?.type || "").toLowerCase();
//       const looksLikePdf = name.endsWith(".pdf") || type.includes("pdf");
//       if (!file || !looksLikePdf) {
//         alert("Please upload a valid PDF file");
//         return;
//       }

//       setUploadingPdf(true);

//       // Secure workflow: upload to backend (sanitize + encrypt at rest), then download sanitized PDF for editing.
//       const formData = new FormData();
//       formData.append("pdf", file);
//       const createRes = await api.post("/documents", formData);

//       const id = createRes.data?.id;
//       if (!id) throw new Error("Upload failed: missing document id");

//       const downloadRes = await api.get(`/documents/${id}/download`, {
//         responseType: "arraybuffer",
//       });
//       const bytes = downloadRes.data;
//       const blob = new Blob([bytes], { type: "application/pdf" });

//       const arrayBuffer = await blob.arrayBuffer();
//       const pdf = await PDFDocument.load(arrayBuffer);
//       setPdfDoc(pdf);
//       const oldUrl = pdfFile;
//       const newUrl = URL.createObjectURL(blob);
//       setPdfFile(newUrl);
//       if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 100);

//       setDocId(id);
//       setTotalPages(pdf.getPageCount());
//       setCurrentPage(1);
//       setGitEnabled(false);
//       setGitSignatureOk(null);
//       setUndoStack([]);
//       setTextBoxes([]);
//       setImageBoxes([]);
//       setTextSelections([]);
//       setRectangleBoxes([]);
//       setCircleBoxes([]);
//       setLineBoxes([]);
//       setEditMode(null);
//       setSelectedTextId(null);
//       setSelectedRectangleId(null);
//       setSelectedCircleId(null);
//       setSelectedLineId(null);
//       fetchRecentDocs();
//     } catch (e) {
//       console.error(e);
//       alert(e?.response?.data?.error || e.message || "Failed to upload PDF");
//     } finally {
//       setUploadingPdf(false);
//       // Reset input so re-uploading same file triggers change
//       event.target.value = "";
//     }
//   };

//   const handleGitInit = async () => {
//     try {
//       if (!docId) {
//         alert("No document loaded");
//         return;
//       }
//       const res = await api.post(`/documents/${docId}/git/init`);
//       const newId = res.data?.id;
//       if (!newId) throw new Error("Init failed");

//       const downloadRes = await api.get(`/documents/${newId}/download`, {
//         responseType: "arraybuffer",
//       });
//       const bytes = downloadRes.data;
//       const blob = new Blob([bytes], { type: "application/pdf" });
//       const arrayBuffer = await blob.arrayBuffer();
//       const pdf = await PDFDocument.load(arrayBuffer);

//       setDocId(newId);
//       setPdfDoc(pdf);
//       const oldUrl = pdfFile;
//       const newUrl = URL.createObjectURL(blob);
//       setPdfFile(newUrl);
//       if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 100);

//       setTotalPages(pdf.getPageCount());
//       setCurrentPage(1);
//       setUndoStack([]);
//       setTextBoxes([]);
//       setImageBoxes([]);
//       setTextSelections([]);
//       setRectangleBoxes([]);
//       setCircleBoxes([]);
//       setLineBoxes([]);
//       setEditMode(null);
//       setSelectedTextId(null);
//       setSelectedRectangleId(null);
//       setSelectedCircleId(null);
//       setSelectedLineId(null);
//       alert("PDF Git initialized and embedded into the PDF");
//     } catch (e) {
//       console.error(e);
//       alert(
//         e?.response?.data?.error || e.message || "Failed to initialize PDF Git",
//       );
//     }
//   };

//   const formatGitHistory = (git) => {
//     if (!git?.head || !git?.commits) return "No history";
//     const lines = [];
//     const headShort = String(git.head).slice(0, 8);
//     lines.push(`Repo: ${git.repoId || "unknown"}`);
//     lines.push(`HEAD -> main (${headShort})`);
//     lines.push("");

//     const seen = new Set();
//     let cur = git.head;
//     let n = 0;
//     while (cur && git.commits[cur] && !seen.has(cur) && n < 30) {
//       seen.add(cur);
//       const c = git.commits[cur];
//       const actor = c.actor?.email || c.actor?.id || "unknown";
//       const short = String(c.id || cur).slice(0, 8);
//       lines.push(`o ${short}  ${c.message}`);
//       lines.push(`|  ${c.ts}  by ${actor}`);
//       if (Array.isArray(c.actions) && c.actions.length > 0) {
//         for (const a of c.actions.slice(0, 8)) {
//           const page = a.page ? ` page=${a.page}` : "";
//           const txt = a.text
//             ? ` text=${JSON.stringify(String(a.text).slice(0, 80))}`
//             : "";
//           lines.push(`|  - ${a.type}${page}${txt}`);
//         }
//         if (c.actions.length > 8) lines.push("  - ...");
//       }
//       lines.push("|");
//       cur = c.parent;
//       n++;
//     }
//     return lines.join("\n");
//   };

//   const handleGitHistory = async (historyWindow) => {
//     if (!docId) {
//       alert("No document loaded");
//       return;
//     }

//     // Prefer a window opened synchronously by the click handler.
//     const w = historyWindow || window.open("", "_blank", "noopener,noreferrer");
//     if (!w) return;

//     const writePage = ({ title, subtitle, body }) => {
//       const safeTitle = String(title || "PDF Git")
//         .replace(/</g, "&lt;")
//         .replace(/>/g, "&gt;");
//       const safeSubtitle = String(subtitle || "")
//         .replace(/</g, "&lt;")
//         .replace(/>/g, "&gt;");
//       const safeBody = String(body || "")
//         .replace(/</g, "&lt;")
//         .replace(/>/g, "&gt;");

//       w.document.open();
//       w.document.write(`<!doctype html>
// <html>
//   <head>
//     <meta charset="utf-8" />
//     <meta name="viewport" content="width=device-width, initial-scale=1" />
//     <title>${safeTitle}</title>
//     <style>
//       :root { color-scheme: light dark; }
//       body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
//       header { padding: 16px 18px; border-bottom: 1px solid rgba(127,127,127,0.25); }
//       h1 { margin: 0; font-size: 18px; }
//       .sub { margin-top: 6px; opacity: 0.8; font-size: 13px; }
//       main { padding: 16px 18px; }
//       pre { white-space: pre-wrap; word-break: break-word; line-height: 1.35; font-size: 13px; }
//       .hint { opacity: 0.75; font-size: 12px; margin-top: 12px; }
//     </style>
//   </head>
//   <body>
//     <header>
//       <h1>${safeTitle}</h1>
//       ${safeSubtitle ? `<div class="sub">${safeSubtitle}</div>` : ""}
//     </header>
//     <main>
//       <pre>${safeBody}</pre>
//       <div class="hint">This view is generated by TEB from embedded PDF metadata.</div>
//     </main>
//   </body>
// </html>`);
//       w.document.close();
//     };

//     writePage({
//       title: "PDF Git — History tree",
//       subtitle: `Document: ${docId}`,
//       body: "Loading…",
//     });

//     try {
//       const res = await api.get(`/documents/${docId}/git`);
//       if (!res.data?.enabled) {
//         writePage({
//           title: "PDF Git — History tree",
//           subtitle: `Document: ${docId}`,
//           body: "PDF Git is not initialized for this PDF.",
//         });
//         return;
//       }

//       const sig = res.data?.signature;
//       const sigLine =
//         typeof sig?.ok === "boolean"
//           ? `Signature: ${sig.ok ? "OK" : "FAIL"}${sig.error ? ` (${sig.error})` : ""}`
//           : "Signature: unknown";

//       writePage({
//         title: "PDF Git — History tree",
//         subtitle: `${sigLine}`,
//         body: formatGitHistory(res.data.git),
//       });
//     } catch (e) {
//       console.error(e);
//       writePage({
//         title: "PDF Git — History tree",
//         subtitle: `Document: ${docId}`,
//         body:
//           e?.response?.data?.error ||
//           e.message ||
//           "Failed to load PDF Git history",
//       });
//     }
//   };

//   const handleGitVerify = async () => {
//     try {
//       if (!docId) {
//         alert("No document loaded");
//         return;
//       }
//       const res = await api.get(`/documents/${docId}/git/verify`);
//       const ok = !!res.data?.ok;
//       const modified = Array.isArray(res.data?.modifiedPages)
//         ? res.data.modifiedPages
//         : [];
//       const sigOk = res.data?.signature?.ok;
//       const sigMsg =
//         typeof sigOk === "boolean"
//           ? `Signature: ${sigOk ? "OK" : "FAIL"}`
//           : "Signature: unknown";
//       if (ok) {
//         alert(`PDF Git verification OK\n${sigMsg}`);
//       } else {
//         alert(
//           `PDF was modified outside authorized flow\nModified pages: ${modified.join(", ") || "unknown"}\n${sigMsg}`,
//         );
//       }
//     } catch (e) {
//       console.error(e);
//       alert(e?.response?.data?.error || e.message || "Verification failed");
//     }
//   };

//   // Handle clicking on PDF to add text box
//   const handleAddTextBox = (coords) => {
//     if (editMode !== "text") return;

//     const pdfScaleFactor =
//       typeof coords.pdfScaleFactor === "number" &&
//       Number.isFinite(coords.pdfScaleFactor)
//         ? coords.pdfScaleFactor
//         : 1 / 1.5;

//     const pdfFontSize = fontSize * pdfScaleFactor;

//     const newTextBox = {
//       id: Date.now(),
//       text: "", // Empty initially - user types directly in the box
//       displayX: coords.displayX, // For CSS positioning
//       displayY: coords.displayY,
//       pdfX: coords.pdfX, // For PDF drawing
//       pdfY: coords.pdfY,
//       fontSize: fontSize,
//       pdfFontSize,
//       pdfScaleFactor,
//       fontFamily: fontFamily,
//       fontWeight: "normal",
//       fontStyle: "normal",
//       color: "#000000",
//       page: currentPage,
//     };

//     setTextBoxes((prev) => [...prev, newTextBox]);
//     setSelectedTextId(newTextBox.id);
//     setAutoFocusTextBoxId(newTextBox.id);

//     // Return cursor to normal after placing one text box
//     setEditMode(null);
//   };

//   // Update text box position when dragged
//   const handleUpdateTextBox = (id, updates) => {
//     setTextBoxes(
//       textBoxes.map((box) => {
//         if (box.id === id) {
//           // If updating position, only update display coordinates
//           // PDF coordinates will be recalculated when applying
//           if (
//             updates.displayX !== undefined ||
//             updates.displayY !== undefined
//           ) {
//             return { ...box, ...updates };
//           }
//           // For text content updates
//           return { ...box, ...updates };
//         }
//         return box;
//       }),
//     );
//   };

//   // Remove a text box
//   const handleRemoveTextBox = (id) => {
//     setTextBoxes(textBoxes.filter((box) => box.id !== id));
//   };

//   // Handle image upload
//   const handleImageUpload = (event) => {
//     const file = event.target.files[0];
//     if (file && file.type.startsWith("image/")) {
//       const reader = new FileReader();
//       reader.onload = (e) => {
//         const img = new Image();
//         img.onload = () => {
//           // Create image box with default size and position
//           const defaultWidth = Math.min(img.width, 300);
//           const defaultHeight = Math.min(img.height, 300);

//           const imageBox = {
//             id: Date.now(),
//             imageData: e.target.result,
//             displayX: 100, // Display coordinates for overlay
//             displayY: 100,
//             pdfX: 100, // PDF coordinates for embedding (will be adjusted)
//             pdfY: 100,
//             pdfWidth: null,
//             pdfHeight: null,
//             width: defaultWidth,
//             height: defaultHeight,
//             originalWidth: img.width,
//             originalHeight: img.height,
//             page: currentPage,
//             fileType: file.type,
//           };
//           setImageBoxes([...imageBoxes, imageBox]);
//           setEditMode("image");
//         };
//         img.src = e.target.result;
//       };
//       reader.readAsDataURL(file);
//     } else {
//       alert("Please select a valid image file (PNG, JPG, etc.)");
//     }
//     // Reset input
//     event.target.value = "";
//   };

//   // Update image box position or size
//   const handleUpdateImageBox = (id, updates) => {
//     setImageBoxes(
//       imageBoxes.map((box) => (box.id === id ? { ...box, ...updates } : box)),
//     );
//   };

//   // Remove an image box
//   const handleRemoveImageBox = (id) => {
//     setImageBoxes(imageBoxes.filter((box) => box.id !== id));
//   };

//   // Apply images to PDF
//   const handleApplyImages = async () => {
//     if (imageBoxes.length === 0) {
//       alert("No images to apply");
//       return;
//     }

//     await saveToUndoStack();

//     const pages = pdfDoc.getPages();

//     // Group images by page
//     const imagesByPage = {};
//     imageBoxes.forEach((box) => {
//       if (!imagesByPage[box.page]) {
//         imagesByPage[box.page] = [];
//       }
//       imagesByPage[box.page].push(box);
//     });

//     // Add images to each page
//     for (const [pageNum, images] of Object.entries(imagesByPage)) {
//       const page = pages[parseInt(pageNum) - 1];
//       const { height: pageHeight } = page.getSize();

//       for (const imgBox of images) {
//         try {
//           // Convert base64 to bytes
//           const base64Data = imgBox.imageData.split(",")[1];
//           const imageBytes = Uint8Array.from(atob(base64Data), (c) =>
//             c.charCodeAt(0),
//           );

//           // Embed image based on type
//           let pdfImage;
//           if (imgBox.fileType === "image/png") {
//             pdfImage = await pdfDoc.embedPng(imageBytes);
//           } else if (
//             imgBox.fileType === "image/jpeg" ||
//             imgBox.fileType === "image/jpg"
//           ) {
//             pdfImage = await pdfDoc.embedJpg(imageBytes);
//           } else {
//             // Try PNG first, fallback to JPG
//             try {
//               pdfImage = await pdfDoc.embedPng(imageBytes);
//             } catch {
//               pdfImage = await pdfDoc.embedJpg(imageBytes);
//             }
//           }

//           // Use PDF coordinates for embedding
//           const pdfY = pageHeight - imgBox.pdfY - imgBox.height;

//           page.drawImage(pdfImage, {
//             x: imgBox.pdfX,
//             y: pdfY,
//             width: imgBox.width,
//             height: imgBox.height,
//           });
//         } catch (error) {
//           console.error("Error embedding image:", error);
//           alert(`Failed to embed image. Error: ${error.message}`);
//         }
//       }
//     }

//     await refreshPDF();
//     setImageBoxes([]);
//     setEditMode(null);
//   };

//   // Handle text selection for highlighting
//   const handleTextSelection = async (selection) => {
//     if (editMode !== "highlight-select") return;
//     if (!pdfDoc) return;
//     if (
//       !selection ||
//       !Array.isArray(selection.rects) ||
//       selection.rects.length === 0
//     )
//       return;
//     if (applyingTextHighlightRef.current) return;

//     applyingTextHighlightRef.current = true;
//     try {
//       await saveToUndoStack();

//       const sel = {
//         ...selection,
//         id: Date.now(),
//         page: currentPage,
//       };

//       await applyTextSelectionsToPdf(pdfDoc, [sel]);
//       await refreshPDF();
//       setTextSelections([]);
//     } finally {
//       applyingTextHighlightRef.current = false;
//     }
//   };

//   // Apply text selection highlights to PDF
//   const handleApplyHighlights = async () => {
//     if (textSelections.length === 0) {
//       alert("No text selections to highlight");
//       return;
//     }

//     await saveToUndoStack();

//     const pages = pdfDoc.getPages();

//     // Group selections by page
//     const selectionsByPage = {};
//     textSelections.forEach((sel) => {
//       if (!selectionsByPage[sel.page]) {
//         selectionsByPage[sel.page] = [];
//       }
//       selectionsByPage[sel.page].push(sel);
//     });

//     // Add highlights to each page
//     for (const [pageNum, selections] of Object.entries(selectionsByPage)) {
//       const page = pages[parseInt(pageNum) - 1];
//       const { height: pageHeight } = page.getSize();

//       selections.forEach((sel) => {
//         sel.rects.forEach((rect) => {
//           const pdfY = pageHeight - rect.y - rect.height;
//           page.drawRectangle({
//             x: rect.x,
//             y: pdfY,
//             width: rect.width,
//             height: rect.height,
//             color: rgb(1, 1, 0),
//             opacity: TEXT_HIGHLIGHT_OPACITY,
//             blendMode: TEXT_HIGHLIGHT_BLEND_MODE,
//           });
//         });
//       });
//     }

//     await refreshPDF();
//     setTextSelections([]);
//     setEditMode(null);
//   };

//   // Remove a text selection
//   const handleRemoveSelection = (id) => {
//     setTextSelections(textSelections.filter((sel) => sel.id !== id));
//   };

//   // Apply text boxes to PDF
//   // const handleApplyText = async () => {
//   //   // Filter out empty text boxes
//   //   const validBoxes = textBoxes.filter(box => box.text.trim())

//   //   if (validBoxes.length === 0) {
//   //     alert('Please add some text to the text boxes')
//   //     return
//   //   }

//   //   await saveToUndoStack()

//   //   const pages = pdfDoc.getPages()
//   //   const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

//   //   // Group text boxes by page
//   //   const boxesByPage = {}
//   //   validBoxes.forEach(box => {
//   //     if (!boxesByPage[box.page]) {
//   //       boxesByPage[box.page] = []
//   //     }
//   //     boxesByPage[box.page].push(box)
//   //   })

//   //   // Add text to each page
//   //   for (const [pageNum, boxes] of Object.entries(boxesByPage)) {
//   //     const page = pages[parseInt(pageNum) - 1]
//   //     const { height: pageHeight } = page.getSize()

//   //     boxes.forEach(box => {
//   //       // Use PDF coordinates that were calculated when placing the text box
//   //       const pdfY = pageHeight - box.pdfY - box.fontSize
//   //       page.drawText(box.text, {
//   //         x: box.pdfX,
//   //         y: pdfY,
//   //         size: box.fontSize,
//   //         font: font,
//   //         color: rgb(0, 0, 0)
//   //       })
//   //     })
//   //   }

//   //   await refreshPDF()
//   //   setTextBoxes([])
//   //   setEditMode(null)
//   // }

//   const getFontBytes = async (url) => {
//     if (!url) return null;
//     const cache = fontBytesCacheRef.current;
//     if (cache.has(url)) return cache.get(url);

//     const res = await fetch(url);
//     if (!res.ok) {
//       throw new Error(`Failed to load font: ${url}`);
//     }
//     const buf = await res.arrayBuffer();
//     const bytes = new Uint8Array(buf);
//     cache.set(url, bytes);
//     return bytes;
//   };

//   const getCustomFontUrl = (fontKey) => {
//     switch (fontKey) {
//       case "inter":
//         return "/fonts/Inter.ttf";
//       case "lato":
//         return "/fonts/Lato-Regular.ttf";
//       case "poppins":
//         return "/fonts/Poppins-Regular.ttf";
//       case "oswald":
//         return "/fonts/Oswald.ttf";
//       case "roboto-condensed":
//         return "/fonts/RobotoCondensed-Regular.ttf";
//       case "signature":
//         return "https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSo3Rep8h-4EeNmE9KQHBY.ttf";
//       default:
//         return null;
//     }
//   };

//   const parseHexColorToRgb = (hex) => {
//     if (typeof hex !== "string") return rgb(0, 0, 0);
//     const raw = hex.trim();
//     if (!raw.startsWith("#")) return rgb(0, 0, 0);
//     const h = raw.slice(1);
//     let r, g, b;
//     if (h.length === 3) {
//       r = parseInt(h[0] + h[0], 16);
//       g = parseInt(h[1] + h[1], 16);
//       b = parseInt(h[2] + h[2], 16);
//     } else if (h.length === 6) {
//       r = parseInt(h.slice(0, 2), 16);
//       g = parseInt(h.slice(2, 4), 16);
//       b = parseInt(h.slice(4, 6), 16);
//     } else {
//       return rgb(0, 0, 0);
//     }

//     if (![r, g, b].every((n) => Number.isFinite(n))) return rgb(0, 0, 0);
//     return rgb(r / 255, g / 255, b / 255);
//   };

//   const getStandardFontName = (fontKey, isBold, isItalic) => {
//     if (fontKey === "helvetica") {
//       if (isBold && isItalic) return StandardFonts.HelveticaBoldOblique;
//       if (isBold) return StandardFonts.HelveticaBold;
//       if (isItalic) return StandardFonts.HelveticaOblique;
//       return StandardFonts.Helvetica;
//     }

//     if (fontKey === "times") {
//       if (isBold && isItalic) return StandardFonts.TimesRomanBoldItalic;
//       if (isBold) return StandardFonts.TimesRomanBold;
//       if (isItalic) return StandardFonts.TimesRomanItalic;
//       return StandardFonts.TimesRoman;
//     }

//     if (fontKey === "courier") {
//       if (isBold && isItalic) return StandardFonts.CourierBoldOblique;
//       if (isBold) return StandardFonts.CourierBold;
//       if (isItalic) return StandardFonts.CourierOblique;
//       return StandardFonts.Courier;
//     }

//     return StandardFonts.Helvetica;
//   };

//   const normalizeFontKey = (value) => {
//     if (!value) return "helvetica";

//     // Already normalized
//     if (
//       value === "helvetica" ||
//       value === "times" ||
//       value === "courier" ||
//       value === "roboto-condensed" ||
//       value === "oswald" ||
//       value === "inter" ||
//       value === "poppins" ||
//       value === "lato"
//     ) {
//       return value;
//     }

//     // Legacy / display values
//     if (value === "Helvetica") return "helvetica";
//     if (value === "TimesRoman" || value === "Times") return "times";
//     if (value === "Courier") return "courier";
//     if (value === "Roboto Condensed" || value === "RobotoCondensed")
//       return "roboto-condensed";
//     if (value === "Oswald") return "oswald";
//     if (value === "Inter") return "inter";
//     if (value === "Poppins") return "poppins";
//     if (value === "Lato") return "lato";

//     return "helvetica";
//   };

//   const applyTextBoxesToPdf = async (doc, boxesToApply) => {
//     if (!doc || !boxesToApply || boxesToApply.length === 0) return;

//     const pages = doc.getPages();
//     const embeddedFontCache = new Map();
//     const fontkitInstance = fontkit?.default ?? fontkit;

//     // Group text boxes by page
//     const boxesByPage = {};
//     boxesToApply.forEach((box) => {
//       if (!boxesByPage[box.page]) {
//         boxesByPage[box.page] = [];
//       }
//       boxesByPage[box.page].push(box);
//     });

//     for (const [pageNum, boxes] of Object.entries(boxesByPage)) {
//       const page = pages[parseInt(pageNum) - 1];
//       const { height } = page.getSize();

//       for (const box of boxes) {
//         let font;
//         const fontKey = normalizeFontKey(box.fontFamily);
//         const isBold =
//           (box.fontWeight ?? "normal") === "bold" || box.isBold === true;
//         const isItalic =
//           (box.fontStyle ?? "normal") === "italic" || box.isItalic === true;

//         const isStandard =
//           fontKey === "helvetica" ||
//           fontKey === "times" ||
//           fontKey === "courier";
//         const fontCacheKey = isStandard
//           ? `${fontKey}:${isBold ? "b" : ""}${isItalic ? "i" : ""}`
//           : fontKey;

//         if (embeddedFontCache.has(fontCacheKey)) {
//           font = embeddedFontCache.get(fontCacheKey);
//         } else {
//           if (isStandard) {
//             const stdFontName = getStandardFontName(fontKey, isBold, isItalic);
//             font = await doc.embedFont(stdFontName);
//           } else {
//             // Embed a real TTF for export so the downloaded PDF matches the editor.
//             // Bold/italic for custom fonts is handled via a simple PDF fallback (see below).
//             const fontUrl = getCustomFontUrl(fontKey);
//             if (!fontUrl || !fontkitInstance) {
//               font = await doc.embedFont(StandardFonts.Helvetica);
//             } else {
//               try {
//                 doc.registerFontkit(fontkitInstance);
//                 const fontBytes = await getFontBytes(fontUrl);
//                 font = await doc.embedFont(fontBytes, { subset: true });
//               } catch {
//                 font = await doc.embedFont(StandardFonts.Helvetica);
//               }
//             }
//           }
//           embeddedFontCache.set(fontCacheKey, font);
//         }

//         const pdfFontSize =
//           typeof box.pdfFontSize === "number" &&
//           Number.isFinite(box.pdfFontSize)
//             ? box.pdfFontSize
//             : box.fontSize;

//         // Match on-screen positioning:
//         // - The on-screen text starts *inside* the text box due to CSS padding.
//         // - pdf-lib draws from the baseline, not from the top.
//         const pdfScaleFactor =
//           typeof box.pdfScaleFactor === "number" &&
//           Number.isFinite(box.pdfScaleFactor)
//             ? box.pdfScaleFactor
//             : 1 / 1.5;

//         const paddingLeftPx = 12;
//         const paddingTopPx = 8;

//         const pdfTextX = box.pdfX + paddingLeftPx * pdfScaleFactor;
//         const pdfTextTop = box.pdfY + paddingTopPx * pdfScaleFactor;

//         // Use ascent (exclude descender) to align top better.
//         let ascentHeight = pdfFontSize;
//         if (typeof font?.heightAtSize === "function") {
//           try {
//             ascentHeight = font.heightAtSize(pdfFontSize, { descender: false });
//           } catch {
//             ascentHeight = font.heightAtSize(pdfFontSize);
//           }
//         }

//         const pdfY = height - pdfTextTop - ascentHeight;

//         const textColor = parseHexColorToRgb(box.color);

//         const shouldFakeItalic = !isStandard && isItalic;
//         const shouldFakeBold = !isStandard && isBold;

//         const drawOptions = {
//           x: pdfTextX,
//           y: pdfY,
//           size: pdfFontSize,
//           font,
//           color: textColor,
//           ...(shouldFakeItalic ? { xSkew: degrees(12) } : {}),
//         };

//         page.drawText(box.text, drawOptions);
//         if (shouldFakeBold) {
//           const boldOffset = Math.max(0.25, pdfFontSize * 0.03);
//           page.drawText(box.text, {
//             ...drawOptions,
//             x: pdfTextX + boldOffset,
//           });
//         }
//       }
//     }
//   };

//   const applyImageBoxesToPdf = async (doc, boxesToApply) => {
//     if (!doc || !boxesToApply || boxesToApply.length === 0) return;

//     const pages = doc.getPages();

//     // Group images by page
//     const imagesByPage = {};
//     boxesToApply.forEach((box) => {
//       if (!imagesByPage[box.page]) {
//         imagesByPage[box.page] = [];
//       }
//       imagesByPage[box.page].push(box);
//     });

//     for (const [pageNum, images] of Object.entries(imagesByPage)) {
//       const page = pages[parseInt(pageNum) - 1];
//       const { height: pageHeight } = page.getSize();

//       for (const imgBox of images) {
//         // Convert base64 to bytes
//         const base64Data = imgBox.imageData.split(",")[1];
//         const imageBytes = Uint8Array.from(atob(base64Data), (c) =>
//           c.charCodeAt(0),
//         );

//         // Embed image based on type
//         let pdfImage;
//         if (imgBox.fileType === "image/png") {
//           pdfImage = await doc.embedPng(imageBytes);
//         } else if (
//           imgBox.fileType === "image/jpeg" ||
//           imgBox.fileType === "image/jpg"
//         ) {
//           pdfImage = await doc.embedJpg(imageBytes);
//         } else {
//           // Try PNG first, fallback to JPG
//           try {
//             pdfImage = await doc.embedPng(imageBytes);
//           } catch {
//             pdfImage = await doc.embedJpg(imageBytes);
//           }
//         }

//         const pdfWidth =
//           typeof imgBox.pdfWidth === "number" &&
//           Number.isFinite(imgBox.pdfWidth)
//             ? imgBox.pdfWidth
//             : imgBox.width;

//         const pdfHeight =
//           typeof imgBox.pdfHeight === "number" &&
//           Number.isFinite(imgBox.pdfHeight)
//             ? imgBox.pdfHeight
//             : imgBox.height;

//         const pdfY = pageHeight - imgBox.pdfY - pdfHeight;
//         page.drawImage(pdfImage, {
//           x: imgBox.pdfX,
//           y: pdfY,
//           width: pdfWidth,
//           height: pdfHeight,
//         });
//       }
//     }
//   };

//   const applyTextSelectionsToPdf = async (doc, selectionsToApply) => {
//     if (!doc || !selectionsToApply || selectionsToApply.length === 0) return;

//     const pages = doc.getPages();

//     // Group selections by page
//     const selectionsByPage = {};
//     selectionsToApply.forEach((sel) => {
//       if (!selectionsByPage[sel.page]) {
//         selectionsByPage[sel.page] = [];
//       }
//       selectionsByPage[sel.page].push(sel);
//     });

//     for (const [pageNum, selections] of Object.entries(selectionsByPage)) {
//       const page = pages[parseInt(pageNum) - 1];
//       const { height: pageHeight } = page.getSize();

//       selections.forEach((sel) => {
//         sel.rects.forEach((rect) => {
//           const pdfY = pageHeight - rect.y - rect.height;
//           page.drawRectangle({
//             x: rect.x,
//             y: pdfY,
//             width: rect.width,
//             height: rect.height,
//             color: rgb(1, 1, 0),
//             opacity: TEXT_HIGHLIGHT_OPACITY,
//             blendMode: TEXT_HIGHLIGHT_BLEND_MODE,
//           });
//         });
//       });
//     }
//   };

//   const applyRectangleBoxesToPdf = async (doc, boxesToApply) => {
//     if (!doc || !boxesToApply || boxesToApply.length === 0) return;

//     const pages = doc.getPages();

//     const byPage = {};
//     boxesToApply.forEach((b) => {
//       if (!byPage[b.page]) byPage[b.page] = [];
//       byPage[b.page].push(b);
//     });

//     for (const [pageNum, boxes] of Object.entries(byPage)) {
//       const page = pages[parseInt(pageNum) - 1];
//       const { height: pageHeight } = page.getSize();

//       for (const box of boxes) {
//         const pdfWidth =
//           typeof box.pdfWidth === "number" && Number.isFinite(box.pdfWidth)
//             ? box.pdfWidth
//             : box.width;
//         const pdfHeight =
//           typeof box.pdfHeight === "number" && Number.isFinite(box.pdfHeight)
//             ? box.pdfHeight
//             : box.height;

//         const pdfY = pageHeight - box.pdfY - pdfHeight;

//         const strokeColor = parseHexColorToRgb(box.strokeColor);
//         const fillColor = parseHexColorToRgb(box.fillColor);

//         const pdfScaleFactor =
//           typeof box.pdfScaleFactor === "number" &&
//           Number.isFinite(box.pdfScaleFactor)
//             ? box.pdfScaleFactor
//             : 1 / 1.5;

//         const strokeWidth =
//           typeof box.strokeWidth === "number" &&
//           Number.isFinite(box.strokeWidth)
//             ? box.strokeWidth
//             : 2;

//         const borderWidth = Math.max(0.25, strokeWidth * pdfScaleFactor);

//         page.drawRectangle({
//           x: box.pdfX,
//           y: pdfY,
//           width: pdfWidth,
//           height: pdfHeight,
//           ...(box.filled ? { color: fillColor } : {}),
//           borderColor: strokeColor,
//           borderWidth,
//         });
//       }
//     }
//   };

//   const applyCircleBoxesToPdf = async (doc, boxesToApply) => {
//     if (!doc || !boxesToApply || boxesToApply.length === 0) return;

//     const pages = doc.getPages();

//     const byPage = {};
//     boxesToApply.forEach((b) => {
//       if (!byPage[b.page]) byPage[b.page] = [];
//       byPage[b.page].push(b);
//     });

//     for (const [pageNum, boxes] of Object.entries(byPage)) {
//       const page = pages[parseInt(pageNum) - 1];
//       const { height: pageHeight } = page.getSize();

//       for (const box of boxes) {
//         const pdfWidth =
//           typeof box.pdfWidth === "number" && Number.isFinite(box.pdfWidth)
//             ? box.pdfWidth
//             : box.width;
//         const pdfHeight =
//           typeof box.pdfHeight === "number" && Number.isFinite(box.pdfHeight)
//             ? box.pdfHeight
//             : box.height;

//         const centerX = box.pdfX + pdfWidth / 2;
//         const centerY = pageHeight - box.pdfY - pdfHeight / 2;

//         const strokeColor = parseHexColorToRgb(box.strokeColor);
//         const fillColor = parseHexColorToRgb(box.fillColor);

//         const pdfScaleFactor =
//           typeof box.pdfScaleFactor === "number" &&
//           Number.isFinite(box.pdfScaleFactor)
//             ? box.pdfScaleFactor
//             : 1 / 1.5;

//         const strokeWidth =
//           typeof box.strokeWidth === "number" &&
//           Number.isFinite(box.strokeWidth)
//             ? box.strokeWidth
//             : 2;

//         const borderWidth = Math.max(0.25, strokeWidth * pdfScaleFactor);

//         page.drawEllipse({
//           x: centerX,
//           y: centerY,
//           xScale: pdfWidth / 2,
//           yScale: pdfHeight / 2,
//           ...(box.filled ? { color: fillColor } : {}),
//           borderColor: strokeColor,
//           borderWidth,
//         });
//       }
//     }
//   };

//   const applyLineBoxesToPdf = async (doc, boxesToApply) => {
//     if (!doc || !boxesToApply || boxesToApply.length === 0) return;

//     const pages = doc.getPages();

//     const byPage = {};
//     boxesToApply.forEach((b) => {
//       if (!byPage[b.page]) byPage[b.page] = [];
//       byPage[b.page].push(b);
//     });

//     for (const [pageNum, boxes] of Object.entries(byPage)) {
//       const page = pages[parseInt(pageNum) - 1];
//       const { height: pageHeight } = page.getSize();

//       for (const box of boxes) {
//         const strokeColor = parseHexColorToRgb(box.strokeColor);

//         const pdfScaleFactor =
//           typeof box.pdfScaleFactor === "number" &&
//           Number.isFinite(box.pdfScaleFactor)
//             ? box.pdfScaleFactor
//             : 1 / 1.5;

//         const strokeWidth =
//           typeof box.strokeWidth === "number" &&
//           Number.isFinite(box.strokeWidth)
//             ? box.strokeWidth
//             : 2;

//         const thickness = Math.max(0.25, strokeWidth * pdfScaleFactor);

//         // New format: endpoints stored directly.
//         const hasEndpoints =
//           typeof box.pdfX1 === "number" &&
//           Number.isFinite(box.pdfX1) &&
//           typeof box.pdfY1 === "number" &&
//           Number.isFinite(box.pdfY1) &&
//           typeof box.pdfX2 === "number" &&
//           Number.isFinite(box.pdfX2) &&
//           typeof box.pdfY2 === "number" &&
//           Number.isFinite(box.pdfY2);

//         let start;
//         let end;
//         if (hasEndpoints) {
//           start = { x: box.pdfX1, y: pageHeight - box.pdfY1 };
//           end = { x: box.pdfX2, y: pageHeight - box.pdfY2 };
//         } else {
//           // Back-compat: older format stored as bounding rect + direction flags
//           const pdfWidth =
//             typeof box.pdfWidth === "number" && Number.isFinite(box.pdfWidth)
//               ? box.pdfWidth
//               : box.width;
//           const pdfHeight =
//             typeof box.pdfHeight === "number" && Number.isFinite(box.pdfHeight)
//               ? box.pdfHeight
//               : box.height;

//           const startOnRight = !!box.startOnRight;
//           const startOnBottom = !!box.startOnBottom;

//           const xLeft = box.pdfX;
//           const xRight = box.pdfX + pdfWidth;
//           const yTop = pageHeight - box.pdfY;
//           const yBottom = pageHeight - box.pdfY - pdfHeight;

//           start = {
//             x: startOnRight ? xRight : xLeft,
//             y: startOnBottom ? yBottom : yTop,
//           };

//           end = {
//             x: startOnRight ? xLeft : xRight,
//             y: startOnBottom ? yTop : yBottom,
//           };
//         }

//         page.drawLine({
//           start,
//           end,
//           thickness,
//           color: strokeColor,
//         });
//       }
//     }
//   };

//   // "Apply" keeps text editable + draggable (Canva/PPT style).
//   // Text is baked into the PDF only when downloading.
//   const handleApplyText = async () => {
//     const validBoxes = textBoxes.filter((box) => box.text.trim());
//     if (validBoxes.length === 0) {
//       alert("Please add some text to the text boxes");
//       return;
//     }

//     setEditMode(null);
//   };

//   const updateSelectedTextBox = (updates) => {
//     if (!selectedTextId) return;

//     setTextBoxes((prev) =>
//       prev.map((box) => {
//         if (box.id !== selectedTextId) return box;

//         const next = { ...box, ...updates };

//         // Keep pdfFontSize consistent with on-screen fontSize
//         if (updates.fontSize !== undefined) {
//           const scaleFactor =
//             typeof box.pdfScaleFactor === "number" &&
//             Number.isFinite(box.pdfScaleFactor)
//               ? box.pdfScaleFactor
//               : 1 / 1.5;
//           next.pdfScaleFactor = scaleFactor;
//           next.pdfFontSize = updates.fontSize * scaleFactor;
//         }

//         return next;
//       }),
//     );
//   };

//   // Ctrl+Z undo functionality
//   useEffect(() => {
//     const handleKeyDown = async (e) => {
//       if ((e.ctrlKey || e.metaKey) && e.key === "z" && undoStack.length > 0) {
//         e.preventDefault();
//         await performUndo();
//       }
//     };

//     window.addEventListener("keydown", handleKeyDown);
//     return () => window.removeEventListener("keydown", handleKeyDown);
//   }, [undoStack]);

//   const saveToUndoStack = async () => {
//     if (!pdfDoc) return;
//     const pdfBytes = await pdfDoc.save();
//     setUndoStack((prev) => [...prev, pdfBytes]);
//   };

//   const performUndo = async () => {
//     if (undoStack.length === 0) return;

//     const newStack = [...undoStack];
//     const previousState = newStack.pop();
//     setUndoStack(newStack);

//     // Restore previous PDF state
//     const restoredPdf = await PDFDocument.load(previousState);
//     setPdfDoc(restoredPdf);

//     const blob = new Blob([previousState], { type: "application/pdf" });
//     const oldUrl = pdfFile;
//     const newUrl = URL.createObjectURL(blob);
//     setPdfFile(newUrl);
//     if (oldUrl) {
//       setTimeout(() => URL.revokeObjectURL(oldUrl), 100);
//     }
//   };

//   const handleAddRectangle = (rect) => {
//     if (!rect) return;

//     const pdfScaleFactor =
//       typeof rect.pdfScaleFactor === "number" &&
//       Number.isFinite(rect.pdfScaleFactor)
//         ? rect.pdfScaleFactor
//         : 1 / 1.5;

//     const newRect = {
//       id: Date.now(),
//       displayX: rect.displayX,
//       displayY: rect.displayY,
//       width: rect.width,
//       height: rect.height,
//       pdfX: rect.pdfX,
//       pdfY: rect.pdfY,
//       pdfWidth: rect.pdfWidth,
//       pdfHeight: rect.pdfHeight,
//       pdfScaleFactor,
//       strokeColor: "#000000",
//       fillColor: "#000000",
//       filled: false,
//       strokeWidth: 2,
//       page: currentPage,
//     };

//     setRectangleBoxes((prev) => [...prev, newRect]);
//     setSelectedRectangleId(newRect.id);
//     setSelectedTextId(null);
//     setSelectedCircleId(null);
//     setSelectedLineId(null);
//     setEditMode(null);
//   };

//   const updateSelectedRectangleBox = (updates) => {
//     if (!selectedRectangleId) return;
//     setRectangleBoxes((prev) =>
//       prev.map((b) =>
//         b.id === selectedRectangleId ? { ...b, ...updates } : b,
//       ),
//     );
//   };

//   const handleRemoveRectangleBox = (id) => {
//     setRectangleBoxes((prev) => prev.filter((b) => b.id !== id));
//     setSelectedRectangleId((prev) => (prev === id ? null : prev));
//   };

//   const handleAddCircle = (circle) => {
//     if (!circle) return;

//     const pdfScaleFactor =
//       typeof circle.pdfScaleFactor === "number" &&
//       Number.isFinite(circle.pdfScaleFactor)
//         ? circle.pdfScaleFactor
//         : 1 / 1.5;

//     const newCircle = {
//       id: Date.now(),
//       displayX: circle.displayX,
//       displayY: circle.displayY,
//       width: circle.width,
//       height: circle.height,
//       pdfX: circle.pdfX,
//       pdfY: circle.pdfY,
//       pdfWidth: circle.pdfWidth,
//       pdfHeight: circle.pdfHeight,
//       pdfScaleFactor,
//       strokeColor: "#000000",
//       fillColor: "#000000",
//       filled: false,
//       strokeWidth: 2,
//       page: currentPage,
//     };

//     setCircleBoxes((prev) => [...prev, newCircle]);
//     setSelectedCircleId(newCircle.id);
//     setSelectedTextId(null);
//     setSelectedRectangleId(null);
//     setSelectedLineId(null);
//     setEditMode(null);
//   };

//   const updateSelectedCircleBox = (updates) => {
//     if (!selectedCircleId) return;
//     setCircleBoxes((prev) =>
//       prev.map((b) => (b.id === selectedCircleId ? { ...b, ...updates } : b)),
//     );
//   };

//   const handleRemoveCircleBox = (id) => {
//     setCircleBoxes((prev) => prev.filter((b) => b.id !== id));
//     setSelectedCircleId((prev) => (prev === id ? null : prev));
//   };

//   const handleAddLine = (line) => {
//     if (!line) return;

//     const pdfScaleFactor =
//       typeof line.pdfScaleFactor === "number" &&
//       Number.isFinite(line.pdfScaleFactor)
//         ? line.pdfScaleFactor
//         : 1 / 1.5;

//     const hasEndpoints =
//       typeof line.x1 === "number" &&
//       Number.isFinite(line.x1) &&
//       typeof line.y1 === "number" &&
//       Number.isFinite(line.y1) &&
//       typeof line.x2 === "number" &&
//       Number.isFinite(line.x2) &&
//       typeof line.y2 === "number" &&
//       Number.isFinite(line.y2);

//     // Back-compat: older payloads used a box + direction.
//     let x1 = line.x1;
//     let y1 = line.y1;
//     let x2 = line.x2;
//     let y2 = line.y2;
//     if (
//       !hasEndpoints &&
//       typeof line.displayX === "number" &&
//       typeof line.displayY === "number" &&
//       typeof line.width === "number" &&
//       typeof line.height === "number"
//     ) {
//       const left = line.displayX;
//       const top = line.displayY;
//       const right = line.displayX + line.width;
//       const bottom = line.displayY + line.height;

//       const startOnRight = !!line.startOnRight;
//       const startOnBottom = !!line.startOnBottom;

//       x1 = startOnRight ? right : left;
//       y1 = startOnBottom ? bottom : top;
//       x2 = startOnRight ? left : right;
//       y2 = startOnBottom ? top : bottom;
//     }

//     const newLine = {
//       id: Date.now(),
//       x1,
//       y1,
//       x2,
//       y2,
//       pdfX1: line.pdfX1,
//       pdfY1: line.pdfY1,
//       pdfX2: line.pdfX2,
//       pdfY2: line.pdfY2,
//       pdfScaleFactor,
//       strokeColor: "#000000",
//       strokeWidth: 2,
//       page: currentPage,
//     };

//     setLineBoxes((prev) => [...prev, newLine]);
//     setSelectedLineId(newLine.id);
//     setSelectedTextId(null);
//     setSelectedRectangleId(null);
//     setSelectedCircleId(null);
//     setEditMode(null);
//   };

//   const updateSelectedLineBox = (updates) => {
//     if (!selectedLineId) return;
//     setLineBoxes((prev) =>
//       prev.map((b) => (b.id === selectedLineId ? { ...b, ...updates } : b)),
//     );
//   };

//   const handleRemoveLineBox = (id) => {
//     setLineBoxes((prev) => prev.filter((b) => b.id !== id));
//     setSelectedLineId((prev) => (prev === id ? null : prev));
//   };

//   const handleAddHighlight = async (x, y, width, height) => {
//     if (!pdfDoc) return;

//     await saveToUndoStack();

//     const pages = pdfDoc.getPages();
//     const page = pages[currentPage - 1];
//     const { height: pageHeight } = page.getSize();
//     const pdfY = pageHeight - y - height;

//     page.drawRectangle({
//       x: x,
//       y: pdfY,
//       width: width,
//       height: height,
//       color: rgb(1, 1, 0),
//       opacity: TEXT_HIGHLIGHT_OPACITY,
//       blendMode: TEXT_HIGHLIGHT_BLEND_MODE,
//     });

//     await refreshPDF();
//   };

//   const refreshPDF = async () => {
//     // Save the current PDF document
//     const pdfBytes = await pdfDoc.save();
//     const blob = new Blob([pdfBytes], { type: "application/pdf" });

//     // Reload the PDF document to ensure we're working with the latest version
//     const arrayBuffer = await blob.arrayBuffer();
//     const reloadedPdf = await PDFDocument.load(arrayBuffer);
//     setPdfDoc(reloadedPdf);

//     // Create new URL and revoke old one to force reload
//     const oldUrl = pdfFile;
//     const newUrl = URL.createObjectURL(blob);
//     setPdfFile(newUrl);
//     if (oldUrl) {
//       setTimeout(() => URL.revokeObjectURL(oldUrl), 100);
//     }
//   };

//   const buildExportPdfBytes = async () => {
//     // Export: bake overlays into a temporary copy of the PDF.
//     const exportBytes = await pdfDoc.save();
//     const exportDoc = await PDFDocument.load(exportBytes);

//     const validTextBoxes = textBoxes.filter((box) => box.text.trim());
//     await applyTextBoxesToPdf(exportDoc, validTextBoxes);
//     await applyImageBoxesToPdf(exportDoc, imageBoxes);
//     await applyTextSelectionsToPdf(exportDoc, textSelections);
//     await applyRectangleBoxesToPdf(exportDoc, rectangleBoxes);
//     await applyCircleBoxesToPdf(exportDoc, circleBoxes);
//     await applyLineBoxesToPdf(exportDoc, lineBoxes);

//     return exportDoc.save();
//   };

//   const triggerBrowserDownload = (bytes, filename) => {
//     const blob = new Blob([bytes], { type: "application/pdf" });
//     const url = URL.createObjectURL(blob);
//     const link = document.createElement("a");
//     link.href = url;
//     link.download = filename || "edited-document.pdf";
//     link.click();
//     setTimeout(() => URL.revokeObjectURL(url), 10_000);
//   };

//   const handleNormalDownload = async () => {
//     if (!pdfDoc) return;
//     const pdfBytes = await buildExportPdfBytes();
//     triggerBrowserDownload(pdfBytes, "edited-document.pdf");
//   };

//   const handleSecureDownload = async () => {
//     if (!pdfDoc) return;

//     const pdfBytes = await buildExportPdfBytes();
//     let downloadBytes = pdfBytes;

//     // Persist to secure backend storage by creating a new version, then download the saved bytes.
//     // After a successful save, reload that saved version into the editor so the visible PDF,
//     // the active docId, and the Git metadata all refer to the same document.
//     if (docId) {
//       try {
//         const fd = new FormData();
//         fd.append(
//           "pdf",
//           new Blob([pdfBytes], { type: "application/pdf" }),
//           "edited.pdf",
//         );

//         const res = await api.post(`/documents/${docId}/update`, fd);
//         const newId = res.data?.id;
//         if (!newId) throw new Error("Update failed");

//         const downloadRes = await api.get(`/documents/${newId}/download`, {
//           responseType: "arraybuffer",
//         });
//         downloadBytes = downloadRes.data;

//         // Refresh editor state to the newly stored, sanitized PDF version.
//         const blob = new Blob([downloadBytes], { type: "application/pdf" });
//         const arrayBuffer = await blob.arrayBuffer();
//         const pdf = await PDFDocument.load(arrayBuffer);

//         setDocId(newId);
//         setPdfDoc(pdf);
//         const oldUrl = pdfFile;
//         const newUrl = URL.createObjectURL(blob);
//         setPdfFile(newUrl);
//         if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 100);

//         setTotalPages(pdf.getPageCount());
//         setCurrentPage(1);
//         setUndoStack([]);
//         setTextBoxes([]);
//         setImageBoxes([]);
//         setTextSelections([]);
//         setRectangleBoxes([]);
//         setCircleBoxes([]);
//         setLineBoxes([]);
//         setEditMode(null);
//         setSelectedTextId(null);
//         setSelectedRectangleId(null);
//         setSelectedCircleId(null);
//         setSelectedLineId(null);

//         // Refresh recent docs after saving
//         fetchRecentDocs();
//       } catch (e) {
//         console.error(e);
//         alert(
//           e?.response?.data?.error ||
//             e.message ||
//             "Failed to save securely (download will still proceed)",
//         );
//       }
//     }

//     triggerBrowserDownload(downloadBytes, "edited-document.pdf");
//   };

//   const handleSecureRedact = async () => {
//     try {
//       if (!docId || !pdfDoc) {
//         alert("No document loaded");
//         return;
//       }

//       // Treat FILLED black rectangles as redactions.
//       const candidates = rectangleBoxes.filter((b) => b?.filled === true);
//       if (candidates.length === 0) {
//         alert("Draw a filled rectangle to redact");
//         return;
//       }

//       const pages = pdfDoc.getPages();
//       const redactionsByPage = new Map();

//       for (const r of candidates) {
//         const pageIndex = (r.page || 1) - 1;
//         const page = pages[pageIndex];
//         if (!page) continue;
//         const { width, height } = page.getSize();

//         const x = (r.pdfX || 0) / width;
//         const y = (r.pdfY || 0) / height;
//         const w = (r.pdfWidth ?? r.width ?? 0) / width;
//         const h = (r.pdfHeight ?? r.height ?? 0) / height;

//         if (
//           !Number.isFinite(x) ||
//           !Number.isFinite(y) ||
//           !Number.isFinite(w) ||
//           !Number.isFinite(h)
//         )
//           continue;
//         const entry = redactionsByPage.get(r.page) || [];
//         entry.push({ x, y, width: w, height: h });
//         redactionsByPage.set(r.page, entry);
//       }

//       const redactions = Array.from(redactionsByPage.entries()).map(
//         ([page, rects]) => ({ page, rects }),
//       );
//       const res = await api.post(`/documents/${docId}/redact`, { redactions });
//       const newId = res.data?.id;
//       if (!newId) throw new Error("Redaction failed");

//       const downloadRes = await api.get(`/documents/${newId}/download`, {
//         responseType: "arraybuffer",
//       });
//       const bytes = downloadRes.data;
//       const blob = new Blob([bytes], { type: "application/pdf" });
//       const arrayBuffer = await blob.arrayBuffer();
//       const pdf = await PDFDocument.load(arrayBuffer);

//       setDocId(newId);
//       setPdfDoc(pdf);
//       const oldUrl = pdfFile;
//       const newUrl = URL.createObjectURL(blob);
//       setPdfFile(newUrl);
//       if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 100);

//       setTotalPages(pdf.getPageCount());
//       setCurrentPage(1);
//       setUndoStack([]);
//       setTextBoxes([]);
//       setImageBoxes([]);
//       setTextSelections([]);
//       setRectangleBoxes([]);
//       setCircleBoxes([]);
//       setLineBoxes([]);
//       setEditMode(null);
//       setSelectedTextId(null);
//       setSelectedRectangleId(null);
//       setSelectedCircleId(null);
//       setSelectedLineId(null);
//     } catch (e) {
//       console.error(e);
//       alert(e?.response?.data?.error || e.message || "Redaction failed");
//     }
//   };

//   const handleEmbeddedSign = async () => {
//     try {
//       if (!docId || !pdfDoc) {
//         alert("No document loaded");
//         return;
//       }

//       if (embeddedSigning) return;
//       setEmbeddedSigning(true);

//       const res = await api.post(`/documents/${docId}/sign-embedded`);
//       const newId = res.data?.id;
//       if (!newId) throw new Error("Embedded signing failed");

//       const downloadRes = await api.get(`/documents/${newId}/download`, {
//         responseType: "arraybuffer",
//       });
//       const bytes = downloadRes.data;
//       const blob = new Blob([bytes], { type: "application/pdf" });
//       const arrayBuffer = await blob.arrayBuffer();
//       const pdf = await PDFDocument.load(arrayBuffer);

//       setDocId(newId);
//       setPdfDoc(pdf);
//       const oldUrl = pdfFile;
//       const newUrl = URL.createObjectURL(blob);
//       setPdfFile(newUrl);
//       if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 100);

//       setTotalPages(pdf.getPageCount());
//       setCurrentPage(1);
//       setUndoStack([]);
//       setTextBoxes([]);
//       setImageBoxes([]);
//       setTextSelections([]);
//       setRectangleBoxes([]);
//       setCircleBoxes([]);
//       setLineBoxes([]);
//       setEditMode(null);
//       setSelectedTextId(null);
//       setSelectedRectangleId(null);
//       setSelectedCircleId(null);
//       setSelectedLineId(null);
//     } catch (e) {
//       console.error(e);
//       alert(e?.response?.data?.error || e.message || "Embedded signing failed");
//     } finally {
//       setEmbeddedSigning(false);
//     }
//   };

//   const handleInspectEmbeddedSignature = async () => {
//     try {
//       if (!docId) {
//         alert("No document loaded");
//         return;
//       }
//       const res = await api.get(
//         `/documents/${docId}/inspect-embedded-signature`,
//       );
//       const inspection = res.data?.inspection;
//       if (!inspection) throw new Error("Inspection failed");
//       alert(
//         inspection.looksSigned
//           ? "Embedded signature detected"
//           : "No embedded signature detected",
//       );
//     } catch (e) {
//       console.error(e);
//       alert(e?.response?.data?.error || e.message || "Inspection failed");
//     }
//   };

//   const handlePageChange = (direction) => {
//     if ((direction === "next" || direction === 1) && currentPage < totalPages) {
//       setCurrentPage(currentPage + 1);
//     } else if ((direction === "prev" || direction === -1) && currentPage > 1) {
//       setCurrentPage(currentPage - 1);
//     }
//     // Don't remove text boxes - keep them all in state
//     // Only render the ones for the current page
//   };

//   // PDF to Images conversion
//   const handlePdfToImages = async () => {
//     if (!convertPdfFile) {
//       alert("Please select a PDF file first");
//       return;
//     }

//     setConverting(true);

//     try {
//       const formData = new FormData();
//       formData.append("pdf", convertPdfFile);

//       const response = await api.post("/pdf-to-images", formData, {
//         responseType: "blob",
//       });

//       const blob = new Blob([response.data], { type: "application/zip" });
//       const url = window.URL.createObjectURL(blob);

//       const link = document.createElement("a");
//       link.href = url;
//       link.download = `${convertPdfFile.name.replace(".pdf", "")}_images.zip`;
//       document.body.appendChild(link);
//       link.click();
//       document.body.removeChild(link);
//       window.URL.revokeObjectURL(url);

//       alert("PDF converted to images successfully!");
//       setConvertPdfFile(null);
//     } catch (error) {
//       console.error("Error converting PDF:", error);
//       alert("Failed to convert PDF to images. Please try again.");
//     } finally {
//       setConverting(false);
//     }
//   };

//   // Images to PDF conversion
//   const handleImagesToPdf = async () => {
//     if (convertImageFiles.length === 0) {
//       alert("Please select at least one image file");
//       return;
//     }

//     setConverting(true);

//     try {
//       const formData = new FormData();
//       convertImageFiles.forEach((file) => {
//         formData.append("images", file);
//       });

//       const response = await api.post("/images-to-pdf", formData, {
//         responseType: "blob",
//       });

//       const blob = new Blob([response.data], { type: "application/pdf" });
//       const url = window.URL.createObjectURL(blob);

//       const link = document.createElement("a");
//       link.href = url;
//       link.download = "converted.pdf";
//       document.body.appendChild(link);
//       link.click();
//       document.body.removeChild(link);
//       window.URL.revokeObjectURL(url);

//       alert("Images converted to PDF successfully!");
//       setConvertImageFiles([]);
//     } catch (error) {
//       console.error("Error converting images:", error);
//       alert("Failed to convert images to PDF. Please try again.");
//     } finally {
//       setConverting(false);
//     }
//   };

//   const handleConvertPdfFileSelect = (event) => {
//     const file = event.target.files[0];
//     if (file && file.type === "application/pdf") {
//       setConvertPdfFile(file);
//     } else {
//       alert("Please select a valid PDF file");
//     }
//   };

//   const handleConvertImageFilesSelect = (event) => {
//     const files = Array.from(event.target.files);
//     const validImages = files.filter(
//       (file) =>
//         file.type === "image/jpeg" ||
//         file.type === "image/png" ||
//         file.type === "image/jpg",
//     );

//     if (validImages.length === 0) {
//       alert("Please select valid image files (JPG, PNG)");
//       return;
//     }

//     setConvertImageFiles(validImages);
//   };

//   // PDF Merge
//   const handleMergePdfFilesSelect = (event) => {
//     const files = Array.from(event.target.files || []);
//     const validPdfs = files.filter((file) => {
//       const name = String(file?.name || "").toLowerCase();
//       const type = String(file?.type || "").toLowerCase();
//       return type.includes("pdf") || name.endsWith(".pdf");
//     });

//     if (validPdfs.length < 2) {
//       alert("Please select at least 2 PDF files");
//       setMergePdfFiles([]);
//       return;
//     }

//     setMergePdfFiles(validPdfs);
//   };

//   const moveMergePdfFile = (fromIndex, toIndex) => {
//     setMergePdfFiles((prev) => {
//       if (!Array.isArray(prev)) return prev;
//       if (fromIndex < 0 || toIndex < 0) return prev;
//       if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
//       if (fromIndex === toIndex) return prev;

//       const next = [...prev];
//       const [item] = next.splice(fromIndex, 1);
//       next.splice(toIndex, 0, item);
//       return next;
//     });
//   };

//   const handleMergePdfs = async () => {
//     if (mergePdfFiles.length < 2) {
//       alert("Please select at least 2 PDF files");
//       return;
//     }

//     setConverting(true);
//     try {
//       const formData = new FormData();
//       mergePdfFiles.forEach((file) => formData.append("pdfs", file));

//       const response = await api.post("/merge-pdfs", formData, {
//         responseType: "blob",
//       });

//       const blob = new Blob([response.data], { type: "application/pdf" });
//       const url = window.URL.createObjectURL(blob);

//       const link = document.createElement("a");
//       link.href = url;
//       link.download = "merged.pdf";
//       document.body.appendChild(link);
//       link.click();
//       document.body.removeChild(link);
//       window.URL.revokeObjectURL(url);

//       alert("PDFs merged successfully!");
//       setMergePdfFiles([]);
//     } catch (error) {
//       console.error("Error merging PDFs:", error);
//       alert(
//         await getApiErrorMessage(
//           error,
//           "Failed to merge PDFs. Please try again.",
//         ),
//       );
//     } finally {
//       setConverting(false);
//     }
//   };

//   // PPT to PDF
//   const handlePptFileSelect = (event) => {
//     const file = event.target.files?.[0];
//     if (!file) return;
//     const name = String(file.name || "").toLowerCase();
//     if (!name.endsWith(".ppt") && !name.endsWith(".pptx")) {
//       alert("Please select a PPT or PPTX file");
//       setPptFile(null);
//       return;
//     }
//     setPptFile(file);
//   };

//   const handlePptToPdf = async () => {
//     if (!pptFile) {
//       alert("Please select a PPT/PPTX file first");
//       return;
//     }

//     setConverting(true);
//     try {
//       const formData = new FormData();
//       formData.append("ppt", pptFile);

//       const response = await api.post("/ppt-to-pdf", formData, {
//         responseType: "blob",
//       });

//       const blob = new Blob([response.data], { type: "application/pdf" });
//       const url = window.URL.createObjectURL(blob);

//       const link = document.createElement("a");
//       link.href = url;
//       link.download = `${pptFile.name.replace(/\.(pptx|ppt)$/i, "")}.pdf`;
//       document.body.appendChild(link);
//       link.click();
//       document.body.removeChild(link);
//       window.URL.revokeObjectURL(url);

//       alert("PPT converted to PDF successfully!");
//       setPptFile(null);
//     } catch (error) {
//       console.error("Error converting PPT to PDF:", error);
//       alert(
//         await getApiErrorMessage(
//           error,
//           "Failed to convert PPT to PDF. Please try again.",
//         ),
//       );
//     } finally {
//       setConverting(false);
//     }
//   };

//   // Lock / Unlock / Watermark
//   const handleLockPdfSelect = (event) => {
//     const file = event.target.files?.[0];
//     if (!file) return;
//     const name = String(file.name || "").toLowerCase();
//     const type = String(file.type || "").toLowerCase();
//     if (!name.endsWith(".pdf") && !type.includes("pdf")) {
//       alert("Please select a valid PDF file");
//       setLockPdfFile(null);
//       return;
//     }
//     setLockPdfFile(file);
//   };

//   const handleUnlockPdfSelect = (event) => {
//     const file = event.target.files?.[0];
//     if (!file) return;
//     const name = String(file.name || "").toLowerCase();
//     const type = String(file.type || "").toLowerCase();
//     if (!name.endsWith(".pdf") && !type.includes("pdf")) {
//       alert("Please select a valid PDF file");
//       setUnlockPdfFile(null);
//       return;
//     }
//     setUnlockPdfFile(file);
//   };

//   const handleWatermarkPdfSelect = (event) => {
//     const file = event.target.files?.[0];
//     if (!file) return;
//     const name = String(file.name || "").toLowerCase();
//     const type = String(file.type || "").toLowerCase();
//     if (!name.endsWith(".pdf") && !type.includes("pdf")) {
//       alert("Please select a valid PDF file");
//       setWatermarkPdfFile(null);
//       return;
//     }
//     setWatermarkPdfFile(file);
//   };

//   const handleLockPdf = async () => {
//     if (!lockPdfFile) {
//       alert("Please select a PDF file first");
//       return;
//     }
//     if (!String(lockPassword || "").trim()) {
//       alert("Please enter a password");
//       return;
//     }

//     setConverting(true);
//     try {
//       const formData = new FormData();
//       formData.append("pdf", lockPdfFile);
//       formData.append("password", lockPassword);

//       const response = await api.post("/lock-pdf", formData, {
//         responseType: "blob",
//       });
//       const blob = new Blob([response.data], { type: "application/pdf" });
//       const url = window.URL.createObjectURL(blob);

//       const link = document.createElement("a");
//       link.href = url;
//       link.download = "locked.pdf";
//       document.body.appendChild(link);
//       link.click();
//       document.body.removeChild(link);
//       window.URL.revokeObjectURL(url);

//       alert("PDF locked successfully!");
//       setLockPdfFile(null);
//       setLockPassword("");
//     } catch (error) {
//       console.error("Error locking PDF:", error);
//       alert(
//         await getApiErrorMessage(
//           error,
//           "Failed to lock PDF. Please try again.",
//         ),
//       );
//     } finally {
//       setConverting(false);
//     }
//   };

//   const handleUnlockPdf = async () => {
//     if (!unlockPdfFile) {
//       alert("Please select a PDF file first");
//       return;
//     }
//     if (!String(unlockPassword || "").trim()) {
//       alert("Please enter the password");
//       return;
//     }

//     setConverting(true);
//     try {
//       const formData = new FormData();
//       formData.append("pdf", unlockPdfFile);
//       formData.append("password", unlockPassword);

//       const response = await api.post("/unlock-pdf", formData, {
//         responseType: "blob",
//       });
//       const blob = new Blob([response.data], { type: "application/pdf" });
//       const url = window.URL.createObjectURL(blob);

//       const link = document.createElement("a");
//       link.href = url;
//       link.download = "unlocked.pdf";
//       document.body.appendChild(link);
//       link.click();
//       document.body.removeChild(link);
//       window.URL.revokeObjectURL(url);

//       alert("PDF unlocked successfully!");
//       setUnlockPdfFile(null);
//       setUnlockPassword("");
//     } catch (error) {
//       console.error("Error unlocking PDF:", error);
//       alert(
//         await getApiErrorMessage(
//           error,
//           "Failed to unlock PDF. Please try again.",
//         ),
//       );
//     } finally {
//       setConverting(false);
//     }
//   };

//   const handleWatermarkPdf = async () => {
//     if (!watermarkPdfFile) {
//       alert("Please select a PDF file first");
//       return;
//     }
//     const text = String(watermarkText || "").trim();
//     if (!text) {
//       alert("Please enter watermark text");
//       return;
//     }

//     setConverting(true);
//     try {
//       const formData = new FormData();
//       formData.append("pdf", watermarkPdfFile);
//       formData.append("text", text);

//       const response = await api.post("/watermark-pdf", formData, {
//         responseType: "blob",
//       });
//       const blob = new Blob([response.data], { type: "application/pdf" });
//       const url = window.URL.createObjectURL(blob);

//       const link = document.createElement("a");
//       link.href = url;
//       link.download = "watermarked.pdf";
//       document.body.appendChild(link);
//       link.click();
//       document.body.removeChild(link);
//       window.URL.revokeObjectURL(url);

//       alert("Watermark added successfully!");
//       setWatermarkPdfFile(null);
//       setWatermarkText("CONFIDENTIAL");
//     } catch (error) {
//       console.error("Error watermarking PDF:", error);
//       alert(
//         await getApiErrorMessage(
//           error,
//           "Failed to watermark PDF. Please try again.",
//         ),
//       );
//     } finally {
//       setConverting(false);
//     }
//   };

//   return (
//     <div className="pdf-editor">
//       <header
//         className="app-header small"
//         style={{
//           display: "flex",
//           justifyContent: "space-between",
//           alignItems: "center",
//           width: "100%",
//           boxSizing: "border-box",
//           borderBottom: "1px solid rgba(140, 148, 145, 0.3)",
//         }}
//       >
//         <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
//           <h1
//             className="header-title"
//             style={{
//               margin: 0,
//               color: "#D2C1B6",
//               display: "flex",
//               alignItems: "center",
//               gap: "10px",
//             }}
//           >
//             <img
//               src="/images/iitr_logo.png"
//               alt="Logo"
//               className="header-logo"
//               style={{ width: "22px", height: "22px" }}
//             />
//             PDF Editor
//           </h1>
//         </div>

//         <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
//           {/* Profile Menu */}
//           <div
//             ref={profileMenuRef}
//             style={{
//               position: "relative",
//               zIndex: 1000,
//             }}
//           >
//             <button
//               onClick={() => setShowProfileMenu(!showProfileMenu)}
//               style={{
//                 background: "none",
//                 border: "none",
//                 cursor: "pointer",
//                 display: "flex",
//                 alignItems: "center",
//                 justifyContent: "center",
//                 padding: "8px",
//                 borderRadius: "50%",
//                 backgroundColor: "rgba(210, 193, 182, 0.1)",
//                 transition: "background-color 0.2s",
//               }}
//               title="Profile Menu"
//             >
//               <svg
//                 width="24"
//                 height="24"
//                 viewBox="0 0 24 24"
//                 fill="none"
//                 stroke="#D2C1B6"
//                 strokeWidth="2"
//                 strokeLinecap="round"
//                 strokeLinelinejoin="round"
//               >
//                 <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
//                 <circle cx="12" cy="7" r="4"></circle>
//               </svg>
//             </button>

//             {showProfileMenu && (
//               <div
//                 style={{
//                   position: "absolute",
//                   top: "100%",
//                   right: 0,
//                   marginTop: "10px",
//                   backgroundColor: "#ffffff",
//                   borderRadius: "8px",
//                   boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
//                   minWidth: "200px",
//                   padding: "1rem",
//                   textAlign: "left",
//                   border: "1px solid #8C9491",
//                   fontFamily: '"Montserrat", sans-serif',
//                 }}
//               >
//                 <div
//                   style={{
//                     borderBottom: "1px solid rgba(140, 148, 145, 0.3)",
//                     paddingBottom: "0.8rem",
//                     marginBottom: "0.8rem",
//                   }}
//                 >
//                   <div
//                     style={{
//                       color: "#1B3C53",
//                       fontWeight: "700",
//                       fontSize: "1.1rem",
//                       marginBottom: "0.2rem",
//                     }}
//                   >
//                     {currentUser?.name || "User"}
//                   </div>
//                   <div style={{ color: "#456882", fontSize: "0.85rem" }}>
//                     {currentUser?.email || ""}
//                   </div>
//                 </div>
//                 <button
//                   onClick={onLogout}
//                   style={{
//                     width: "100%",
//                     backgroundColor: "#dc3545",
//                     color: "white",
//                     border: "none",
//                     padding: "10px",
//                     borderRadius: "4px",
//                     cursor: "pointer",
//                     fontWeight: "bold",
//                     fontFamily: '"Montserrat", sans-serif',
//                     display: "flex",
//                     alignItems: "center",
//                     justifyContent: "center",
//                     gap: "8px",
//                   }}
//                 >
//                   <svg
//                     width="16"
//                     height="16"
//                     viewBox="0 0 24 24"
//                     fill="none"
//                     stroke="currentColor"
//                     strokeWidth="2"
//                     strokeLinecap="round"
//                     strokeLinelinejoin="round"
//                   >
//                     <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
//                     <polyline points="16 17 21 12 16 7"></polyline>
//                     <line x1="21" y1="12" x2="9" y2="12"></line>
//                   </svg>
//                   Logout
//                 </button>
//               </div>
//             )}
//           </div>
//         </div>
//       </header>
//       {!pdfFile ? (
//         loadingPdf || uploadingPdf ? (
//           <div
//             style={{
//               display: "flex",
//               flexDirection: "column",
//               alignItems: "center",
//               justifyContent: "center",
//               minHeight: "60vh",
//               width: "100%",
//             }}
//           >
//             <div
//               style={{
//                 color: "#1B3C53",
//                 fontSize: "1.8rem",
//                 marginBottom: "20px",
//                 fontFamily: '"Oswald", sans-serif',
//               }}
//             >
//               {loadingPdf ? "Loading document..." : "Uploading & sanitizing..."}
//             </div>
//             <div
//               style={{
//                 width: "40px",
//                 height: "40px",
//                 border: "4px solid rgba(27, 60, 83, 0.2)",
//                 borderTop: "4px solid #1B3C53",
//                 borderRadius: "50%",
//                 animation: "spin 1s linear infinite",
//               }}
//             ></div>
//             <style>{`
//               @keyframes spin {
//                 0% { transform: rotate(0deg); }
//                 100% { transform: rotate(360deg); }
//               }
//             `}</style>
//           </div>
//         ) : (
//           <div className="upload-section">
//             <h2
//               style={{
//                 color: "#1B3C53",
//                 fontFamily: '"Oswald", sans-serif',
//                 fontSize: "2.5rem",
//                 marginBottom: "2rem",
//                 marginTop: 0,
//               }}
//             >
//               Hi, {currentUser?.name || currentUser?.email || "User"}
//             </h2>
//             <input
//               type="file"
//               accept="application/pdf"
//               onChange={handleFileUpload}
//               ref={fileInputRef}
//               style={{ display: "none" }}
//             />
//             <button
//               className="upload-btn"
//               onClick={() => fileInputRef.current.click()}
//               disabled={uploadingPdf || loadingPdf}
//             >
//               {uploadingPdf
//                 ? "Uploading & sanitizing…"
//                 : loadingPdf
//                   ? "Loading document…"
//                   : "Click to select a PDF file to edit"}
//             </button>

//             <div className="conversion-section">
//               <h3>Quick Conversion Tools</h3>

//               <div className="conversion-tools-grid">
//                 <div className="conversion-tool">
//                   <h4>PDF to Images</h4>
//                   <input
//                     type="file"
//                     accept="application/pdf"
//                     onChange={handleConvertPdfFileSelect}
//                     ref={convertPdfInputRef}
//                     style={{ display: "none" }}
//                   />
//                   <button
//                     className="conversion-btn"
//                     onClick={() => convertPdfInputRef.current.click()}
//                   >
//                     {convertPdfFile
//                       ? `Selected: ${convertPdfFile.name}`
//                       : "Choose PDF"}
//                   </button>
//                   {convertPdfFile && (
//                     <button
//                       className="convert-action-btn"
//                       onClick={handlePdfToImages}
//                       disabled={converting}
//                     >
//                       {converting ? "Converting..." : "Convert to Images"}
//                     </button>
//                   )}
//                 </div>

//                 <div className="conversion-tool">
//                   <h4>Images to PDF</h4>
//                   <input
//                     type="file"
//                     accept="image/jpeg,image/png,image/jpg"
//                     onChange={handleConvertImageFilesSelect}
//                     ref={convertImageInputRef}
//                     multiple
//                     style={{ display: "none" }}
//                   />
//                   <button
//                     className="conversion-btn"
//                     onClick={() => convertImageInputRef.current.click()}
//                   >
//                     {convertImageFiles.length > 0
//                       ? `Selected: ${convertImageFiles.length} image${convertImageFiles.length > 1 ? "s" : ""}`
//                       : "Choose Images"}
//                   </button>
//                   {convertImageFiles.length > 0 && (
//                     <button
//                       className="convert-action-btn"
//                       onClick={handleImagesToPdf}
//                       disabled={converting}
//                     >
//                       {converting ? "Converting..." : "Convert to PDF"}
//                     </button>
//                   )}
//                 </div>

//                 <div className="conversion-tool">
//                   <h4>Merge PDFs</h4>
//                   <input
//                     type="file"
//                     accept="application/pdf"
//                     onChange={handleMergePdfFilesSelect}
//                     ref={mergePdfInputRef}
//                     multiple
//                     style={{ display: "none" }}
//                   />
//                   <button
//                     className="conversion-btn"
//                     onClick={() => mergePdfInputRef.current.click()}
//                   >
//                     {mergePdfFiles.length > 0
//                       ? `Selected: ${mergePdfFiles.length} PDF${mergePdfFiles.length > 1 ? "s" : ""}`
//                       : "Choose PDFs"}
//                   </button>

//                   {mergePdfFiles.length > 0 && (
//                     <div className="merge-order">
//                       <div className="merge-order-title">Order</div>
//                       <div className="merge-order-list">
//                         {mergePdfFiles.map((file, index) => (
//                           <div
//                             className="merge-order-item"
//                             key={`${file.name}-${index}`}
//                           >
//                             <div className="merge-order-name" title={file.name}>
//                               {index + 1}. {file.name}
//                             </div>
//                             <div className="merge-order-controls">
//                               <button
//                                 type="button"
//                                 className="merge-order-btn"
//                                 onClick={() =>
//                                   moveMergePdfFile(index, index - 1)
//                                 }
//                                 disabled={converting || index === 0}
//                                 title="Move up"
//                               >
//                                 ↑
//                               </button>
//                               <button
//                                 type="button"
//                                 className="merge-order-btn"
//                                 onClick={() =>
//                                   moveMergePdfFile(index, index + 1)
//                                 }
//                                 disabled={
//                                   converting ||
//                                   index === mergePdfFiles.length - 1
//                                 }
//                                 title="Move down"
//                               >
//                                 ↓
//                               </button>
//                             </div>
//                           </div>
//                         ))}
//                       </div>
//                     </div>
//                   )}

//                   {mergePdfFiles.length > 0 && (
//                     <button
//                       className="convert-action-btn"
//                       onClick={handleMergePdfs}
//                       disabled={converting}
//                     >
//                       {converting ? "Merging..." : "Merge PDFs"}
//                     </button>
//                   )}
//                 </div>

//                 <div className="conversion-tool">
//                   <h4>PPT to PDF</h4>
//                   <input
//                     type="file"
//                     accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
//                     onChange={handlePptFileSelect}
//                     ref={pptInputRef}
//                     style={{ display: "none" }}
//                   />
//                   <button
//                     className="conversion-btn"
//                     onClick={() => pptInputRef.current.click()}
//                   >
//                     {pptFile ? `Selected: ${pptFile.name}` : "Choose PPT"}
//                   </button>
//                   {pptFile && (
//                     <button
//                       className="convert-action-btn"
//                       onClick={handlePptToPdf}
//                       disabled={converting}
//                     >
//                       {converting ? "Converting..." : "Convert to PDF"}
//                     </button>
//                   )}
//                 </div>
//               </div>

//               <div className="conversion-tools-grid-bottom">
//                 <div className="conversion-tool">
//                   <h4>Lock PDF</h4>
//                   <input
//                     type="file"
//                     accept="application/pdf"
//                     onChange={handleLockPdfSelect}
//                     ref={lockPdfInputRef}
//                     style={{ display: "none" }}
//                   />
//                   <button
//                     className="conversion-btn"
//                     onClick={() => lockPdfInputRef.current.click()}
//                   >
//                     {lockPdfFile
//                       ? `Selected: ${lockPdfFile.name}`
//                       : "Choose PDF"}
//                   </button>
//                   {lockPdfFile && (
//                     <>
//                       <input
//                         className="conversion-input"
//                         type="password"
//                         placeholder="Password"
//                         value={lockPassword}
//                         onChange={(e) => setLockPassword(e.target.value)}
//                         disabled={converting}
//                       />
//                       <button
//                         className="convert-action-btn"
//                         onClick={handleLockPdf}
//                         disabled={converting}
//                       >
//                         {converting ? "Locking..." : "Lock PDF"}
//                       </button>
//                     </>
//                   )}
//                 </div>

//                 <div className="conversion-tool">
//                   <h4>Unlock PDF</h4>
//                   <input
//                     type="file"
//                     accept="application/pdf"
//                     onChange={handleUnlockPdfSelect}
//                     ref={unlockPdfInputRef}
//                     style={{ display: "none" }}
//                   />
//                   <button
//                     className="conversion-btn"
//                     onClick={() => unlockPdfInputRef.current.click()}
//                   >
//                     {unlockPdfFile
//                       ? `Selected: ${unlockPdfFile.name}`
//                       : "Choose PDF"}
//                   </button>
//                   {unlockPdfFile && (
//                     <>
//                       <input
//                         className="conversion-input"
//                         type="password"
//                         placeholder="Password"
//                         value={unlockPassword}
//                         onChange={(e) => setUnlockPassword(e.target.value)}
//                         disabled={converting}
//                       />
//                       <button
//                         className="convert-action-btn"
//                         onClick={handleUnlockPdf}
//                         disabled={converting}
//                       >
//                         {converting ? "Unlocking..." : "Unlock PDF"}
//                       </button>
//                     </>
//                   )}
//                 </div>

//                 <div className="conversion-tool">
//                   <h4>Watermark</h4>
//                   <input
//                     type="file"
//                     accept="application/pdf"
//                     onChange={handleWatermarkPdfSelect}
//                     ref={watermarkPdfInputRef}
//                     style={{ display: "none" }}
//                   />
//                   <button
//                     className="conversion-btn"
//                     onClick={() => watermarkPdfInputRef.current.click()}
//                   >
//                     {watermarkPdfFile
//                       ? `Selected: ${watermarkPdfFile.name}`
//                       : "Choose PDF"}
//                   </button>
//                   {watermarkPdfFile && (
//                     <>
//                       <input
//                         className="conversion-input"
//                         type="text"
//                         placeholder="Watermark text"
//                         value={watermarkText}
//                         onChange={(e) => setWatermarkText(e.target.value)}
//                         disabled={converting}
//                       />
//                       <button
//                         className="convert-action-btn"
//                         onClick={handleWatermarkPdf}
//                         disabled={converting}
//                       >
//                         {converting ? "Adding..." : "Add Watermark"}
//                       </button>
//                     </>
//                   )}
//                 </div>

//                 <div className="conversion-tool">
//                   <h4>Sign PDF</h4>
//                   <input
//                     type="file"
//                     accept="application/pdf"
//                     onChange={handleSignPdfSelect}
//                     ref={signPdfInputRef}
//                     style={{ display: "none" }}
//                   />
//                   <button
//                     className="conversion-btn"
//                     onClick={() => signPdfInputRef.current.click()}
//                     disabled={uploadingPdf || loadingPdf}
//                   >
//                     {uploadingPdf
//                       ? "Uploading …"
//                       : loadingPdf
//                         ? "Loading document…"
//                         : "Choose PDF"}
//                   </button>
//                 </div>
//               </div>

//               <div style={{ marginTop: "24px", width: "100%" }}>
//                 <div
//                   style={{
//                     padding: "16px 20px",
//                     borderBottom: "1px solid #eee",
//                     fontWeight: "600",
//                     color: "#1B3C53",
//                     fontFamily: '"Oswald", sans-serif',
//                     fontSize: "1.2rem",
//                     display: "flex",
//                     justifyContent: "space-between",
//                     alignItems: "center",
//                   }}
//                 >
//                   Recent PDFs
//                   <span
//                     style={{
//                       fontSize: "0.85rem",
//                       fontWeight: "400",
//                       color: "#8C9491",
//                       fontFamily: '"Montserrat", sans-serif',
//                     }}
//                   >
//                     {recentDocs.length} shown
//                   </span>
//                 </div>

//                 {recentDocs.length === 0 ? (
//                   <div
//                     style={{
//                       padding: "22px 20px",
//                       textAlign: "center",
//                       color: "#8C9491",
//                       fontSize: "0.95rem",
//                     }}
//                   >
//                     No recent PDFs found
//                   </div>
//                 ) : (
//                   <div style={{ border: "1px solid rgba(140, 148, 145, 0.2)" }}>
//                     {recentDocs.map((doc) => (
//                       <div
//                         key={doc._id}
//                         onClick={() => {
//                           window.location.href = `/?doc=${doc._id}`;
//                         }}
//                         style={{
//                           padding: "14px 20px",
//                           borderBottom: "1px solid #f5f5f5",
//                           cursor: "pointer",
//                           display: "flex",
//                           flexDirection: "column",
//                           gap: "6px",
//                           transition: "background-color 0.2s",
//                         }}
//                         onMouseEnter={(e) =>
//                           (e.currentTarget.style.backgroundColor = "#f8f9fa")
//                         }
//                         onMouseLeave={(e) =>
//                           (e.currentTarget.style.backgroundColor =
//                             "transparent")
//                         }
//                       >
//                         <div
//                           style={{
//                             color: "#1B3C53",
//                             fontWeight: "600",
//                             fontSize: "1.02rem",
//                             whiteSpace: "nowrap",
//                             overflow: "hidden",
//                             textOverflow: "ellipsis",
//                           }}
//                         >
//                           {doc.originalName || "Untitled Document"}
//                         </div>
//                         <div
//                           style={{
//                             color: "#8C9491",
//                             fontSize: "0.85rem",
//                             display: "flex",
//                             justifyContent: "space-between",
//                             alignItems: "center",
//                           }}
//                         >
//                           <span>
//                             {new Date(doc.updatedAt).toLocaleDateString()}
//                           </span>
//                           <span>
//                             {new Date(doc.updatedAt).toLocaleTimeString([], {
//                               hour: "2-digit",
//                               minute: "2-digit",
//                             })}
//                           </span>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>
//         )
//       ) : (
//         <>
//           {signingMode ? (
//             <div
//               className="toolbar"
//               style={{
//                 background: "#1B3C53",
//                 padding: "1rem 2rem",
//                 display: "flex",
//                 justifyContent: "space-between",
//                 alignItems: "center",
//                 color: "#D2C1B6",
//               }}
//             >
//               <div
//                 style={{ display: "flex", gap: "1rem", alignItems: "center" }}
//               >
//                 <button
//                   onClick={() => signPdfInputRef.current.click()}
//                   style={{
//                     background: "#456882",
//                     color: "#D2C1B6",
//                     border: "none",
//                     padding: "0.5rem 1rem",
//                     borderRadius: "4px",
//                     cursor: "pointer",
//                   }}
//                 >
//                   Open New PDF
//                 </button>
//                 <button
//                   onClick={() => setShowNameModal(true)}
//                   style={{
//                     background: "#456882",
//                     color: "#D2C1B6",
//                     border: "none",
//                     padding: "0.5rem 1rem",
//                     borderRadius: "4px",
//                     cursor: "pointer",
//                   }}
//                 >
//                   Text
//                 </button>
//                 <button
//                   onClick={() => setDrawingMode(true)}
//                   style={{
//                     background: "#456882",
//                     color: "#D2C1B6",
//                     border: "none",
//                     padding: "0.5rem 1rem",
//                     borderRadius: "4px",
//                     cursor: "pointer",
//                   }}
//                 >
//                   Draw
//                 </button>
//                 <button
//                   onClick={() => imageInputRef.current.click()}
//                   style={{
//                     background: "#456882",
//                     color: "#D2C1B6",
//                     border: "none",
//                     padding: "0.5rem 1rem",
//                     borderRadius: "4px",
//                     cursor: "pointer",
//                   }}
//                 >
//                   Upload
//                 </button>
//               </div>
//               <div
//                 style={{ display: "flex", gap: "1rem", alignItems: "center" }}
//               >
//                 <button
//                   onClick={() => handlePageChange("prev")}
//                   disabled={currentPage <= 1}
//                   style={{
//                     background: "#456882",
//                     color: "#D2C1B6",
//                     border: "none",
//                     padding: "0.5rem",
//                     borderRadius: "4px",
//                     cursor: "pointer",
//                   }}
//                 >
//                   ‹
//                 </button>
//                 <span>
//                   {currentPage} / {totalPages}
//                 </span>
//                 <button
//                   onClick={() => handlePageChange("next")}
//                   disabled={currentPage >= totalPages}
//                   style={{
//                     background: "#456882",
//                     color: "#D2C1B6",
//                     border: "none",
//                     padding: "0.5rem",
//                     borderRadius: "4px",
//                     cursor: "pointer",
//                   }}
//                 >
//                   ›
//                 </button>
//                 <button
//                   onClick={async () => {
//                     const bytes = await buildExportPdfBytes();
//                     triggerBrowserDownload(
//                       bytes,
//                       `signed_${signingPdfFile.name}`,
//                     );
//                   }}
//                   style={{
//                     background: "#456882",
//                     color: "#D2C1B6",
//                     border: "none",
//                     padding: "0.5rem 1rem",
//                     borderRadius: "4px",
//                     cursor: "pointer",
//                   }}
//                 >
//                   Download
//                 </button>
//               </div>
//             </div>
//           ) : (
//             <Toolbar
//               editMode={editMode}
//               setEditMode={setEditMode}
//               fontSize={fontSize}
//               setFontSize={setFontSize}
//               onDownload={handleNormalDownload}
//               onSecureDownload={handleSecureDownload}
//               onUndo={performUndo}
//               onApplyText={handleApplyText}
//               hasTextBoxes={textBoxes.length > 0}
//               fontFamily={fontFamily}
//               setFontFamily={setFontFamily}
//               updateSelectedTextBox={updateSelectedTextBox}
//               selectedTextId={selectedTextId}
//               onDeselectText={() => setSelectedTextId(null)}
//               textBoxes={textBoxes}
//               selectedRectangleId={selectedRectangleId}
//               rectangleBoxes={rectangleBoxes}
//               updateSelectedRectangleBox={updateSelectedRectangleBox}
//               onDeselectRectangle={() => setSelectedRectangleId(null)}
//               onRemoveRectangleBox={handleRemoveRectangleBox}
//               selectedCircleId={selectedCircleId}
//               circleBoxes={circleBoxes}
//               updateSelectedCircleBox={updateSelectedCircleBox}
//               onDeselectCircle={() => setSelectedCircleId(null)}
//               onRemoveCircleBox={handleRemoveCircleBox}
//               selectedLineId={selectedLineId}
//               lineBoxes={lineBoxes}
//               updateSelectedLineBox={updateSelectedLineBox}
//               onDeselectLine={() => setSelectedLineId(null)}
//               onRemoveLineBox={handleRemoveLineBox}
//               onApplyImages={handleApplyImages}
//               hasImages={imageBoxes.length > 0}
//               onImageUpload={() => imageInputRef.current.click()}
//               onApplyHighlights={handleApplyHighlights}
//               hasTextSelections={textSelections.length > 0}
//               canUndo={undoStack.length > 0}
//               currentPage={currentPage}
//               totalPages={totalPages}
//               onPageChange={handlePageChange}
//               onUploadNew={() => fileInputRef.current.click()}
//               onSecureRedact={handleSecureRedact}
//               canSecureRedact={rectangleBoxes.some((b) => b?.filled === true)}
//               onEmbeddedSign={handleEmbeddedSign}
//               embeddedSignDisabled={embeddedSigning}
//               onInspectEmbeddedSignature={handleInspectEmbeddedSignature}
//               onLogout={onLogout}
//               gitEnabled={gitEnabled}
//               gitSignatureOk={gitSignatureOk}
//               gitDocId={docId}
//               onGitInit={handleGitInit}
//               onGitHistory={handleGitHistory}
//               onGitVerify={handleGitVerify}
//             />
//           )}
//           <input
//             type="file"
//             accept="application/pdf"
//             onChange={handleSignPdfSelect}
//             ref={signPdfInputRef}
//             style={{ display: "none" }}
//           />
//           <input
//             type="file"
//             accept="application/pdf"
//             onChange={handleFileUpload}
//             ref={fileInputRef}
//             style={{ display: "none" }}
//           />
//           <input
//             type="file"
//             accept="image/*"
//             onChange={handleImageUpload}
//             ref={imageInputRef}
//             style={{ display: "none" }}
//           />
//           <PDFViewer
//             pdfFile={pdfFile}
//             currentPage={currentPage}
//             editMode={editMode}
//             fetchOcrForPage={fetchOcrForPage}
//             textBoxes={textBoxes.filter((box) => box.page === currentPage)}
//             imageBoxes={imageBoxes.filter((box) => box.page === currentPage)}
//             textSelections={textSelections.filter(
//               (sel) => sel.page === currentPage,
//             )}
//             rectangleBoxes={rectangleBoxes.filter(
//               (b) => b.page === currentPage,
//             )}
//             selectedTextId={selectedTextId}
//             setSelectedTextId={setSelectedTextId}
//             selectedRectangleId={selectedRectangleId}
//             setSelectedRectangleId={setSelectedRectangleId}
//             circleBoxes={circleBoxes.filter((b) => b.page === currentPage)}
//             selectedCircleId={selectedCircleId}
//             setSelectedCircleId={setSelectedCircleId}
//             lineBoxes={lineBoxes.filter((b) => b.page === currentPage)}
//             selectedLineId={selectedLineId}
//             setSelectedLineId={setSelectedLineId}
//             autoFocusTextBoxId={autoFocusTextBoxId}
//             onAutoFocusTextBoxDone={() => setAutoFocusTextBoxId(null)}
//             onAddTextBox={handleAddTextBox}
//             onUpdateTextBox={handleUpdateTextBox}
//             onRemoveTextBox={handleRemoveTextBox}
//             onUpdateImageBox={handleUpdateImageBox}
//             onRemoveImageBox={handleRemoveImageBox}
//             onUpdateRectangleBox={(id, updates) => {
//               setRectangleBoxes((prev) =>
//                 prev.map((b) => (b.id === id ? { ...b, ...updates } : b)),
//               );
//             }}
//             onRemoveRectangleBox={handleRemoveRectangleBox}
//             onUpdateCircleBox={(id, updates) => {
//               setCircleBoxes((prev) =>
//                 prev.map((b) => (b.id === id ? { ...b, ...updates } : b)),
//               );
//             }}
//             onRemoveCircleBox={handleRemoveCircleBox}
//             onUpdateLineBox={(id, updates) => {
//               setLineBoxes((prev) =>
//                 prev.map((b) => (b.id === id ? { ...b, ...updates } : b)),
//               );
//             }}
//             onRemoveLineBox={handleRemoveLineBox}
//             onTextSelection={handleTextSelection}
//             onRemoveSelection={handleRemoveSelection}
//             onAddRectangle={handleAddRectangle}
//             onAddCircle={handleAddCircle}
//             onAddLine={handleAddLine}
//             onAddHighlight={handleAddHighlight}
//           />
//           {drawingMode && (
//             <div
//               style={{
//                 position: "fixed",
//                 top: 0,
//                 left: 0,
//                 width: "100vw",
//                 height: "100vh",
//                 background: "rgba(0,0,0,0.8)",
//                 display: "flex",
//                 justifyContent: "center",
//                 alignItems: "center",
//                 zIndex: 10000,
//               }}
//             >
//               <div
//                 style={{
//                   background: "white",
//                   padding: "20px",
//                   borderRadius: "8px",
//                   display: "flex",
//                   flexDirection: "column",
//                   alignItems: "center",
//                 }}
//               >
//                 <h3>Draw your signature</h3>
//                 <canvas
//                   ref={drawingCanvasRef}
//                   width={400}
//                   height={200}
//                   style={{
//                     border: "1px solid #ccc",
//                     cursor: "crosshair",
//                     background: "white",
//                   }}
//                   onMouseDown={(e) => {
//                     const canvas = drawingCanvasRef.current;
//                     const ctx = canvas.getContext("2d");
//                     ctx.beginPath();
//                     ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
//                     setDrawingCanvas(true);
//                   }}
//                   onMouseMove={(e) => {
//                     if (drawingCanvas) {
//                       const canvas = drawingCanvasRef.current;
//                       const ctx = canvas.getContext("2d");
//                       ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
//                       ctx.stroke();
//                     }
//                   }}
//                   onMouseUp={() => setDrawingCanvas(false)}
//                 />
//                 <div
//                   style={{ marginTop: "10px", display: "flex", gap: "10px" }}
//                 >
//                   <button
//                     onClick={() => {
//                       const canvas = drawingCanvasRef.current;
//                       canvas.toBlob((blob) => {
//                         const file = new File([blob], "signature.png", {
//                           type: "image/png",
//                         });
//                         handleImageUpload({ target: { files: [file] } });
//                         setDrawingMode(false);
//                       });
//                     }}
//                     style={{
//                       padding: "10px 20px",
//                       background: "#456882",
//                       color: "white",
//                       border: "none",
//                       borderRadius: "4px",
//                       cursor: "pointer",
//                     }}
//                   >
//                     Apply
//                   </button>
//                   <button
//                     onClick={() => {
//                       const canvas = drawingCanvasRef.current;
//                       const ctx = canvas.getContext("2d");
//                       ctx.clearRect(0, 0, canvas.width, canvas.height);
//                     }}
//                     style={{
//                       padding: "10px 20px",
//                       background: "#8C9491",
//                       color: "white",
//                       border: "none",
//                       borderRadius: "4px",
//                       cursor: "pointer",
//                     }}
//                   >
//                     Clear
//                   </button>
//                   <button
//                     onClick={() => setDrawingMode(false)}
//                     style={{
//                       padding: "10px 20px",
//                       background: "#dc3545",
//                       color: "white",
//                       border: "none",
//                       borderRadius: "4px",
//                       cursor: "pointer",
//                     }}
//                   >
//                     Cancel
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}
//           {showNameModal && (
//             <div
//               style={{
//                 position: "fixed",
//                 top: 0,
//                 left: 0,
//                 width: "100vw",
//                 height: "100vh",
//                 background: "rgba(0,0,0,0.5)",
//                 display: "flex",
//                 justifyContent: "center",
//                 alignItems: "center",
//                 zIndex: 10001,
//               }}
//             >
//               <div
//                 style={{
//                   background: "white",
//                   padding: "20px",
//                   borderRadius: "8px",
//                   display: "flex",
//                   flexDirection: "column",
//                   alignItems: "center",
//                   minWidth: "300px",
//                 }}
//               >
//                 <h3>Enter your full name for signature</h3>
//                 <input
//                   type="text"
//                   value={signatureName}
//                   onChange={(e) => setSignatureName(e.target.value)}
//                   placeholder="Full Name"
//                   style={{
//                     width: "100%",
//                     padding: "10px",
//                     margin: "10px 0",
//                     border: "1px solid #ccc",
//                     borderRadius: "4px",
//                     fontSize: "16px",
//                   }}
//                   autoFocus
//                 />
//                 <div style={{ display: "flex", gap: "10px" }}>
//                   <button
//                     onClick={async () => {
//                       if (signatureName.trim()) {
//                         // Create a canvas to render the text as image
//                         const canvas = document.createElement("canvas");
//                         const ctx = canvas.getContext("2d");
//                         ctx.font = '24px "Dancing Script", cursive';
//                         const textWidth = ctx.measureText(
//                           signatureName.trim(),
//                         ).width;
//                         canvas.width = textWidth + 20;
//                         canvas.height = 50;
//                         ctx.font = '24px "Dancing Script", cursive';
//                         ctx.fillStyle = "#000000";
//                         ctx.fillText(signatureName.trim(), 10, 30);

//                         canvas.toBlob(async (blob) => {
//                           const file = new File([blob], "signature.png", {
//                             type: "image/png",
//                           });
//                           const url = URL.createObjectURL(file);
//                           const pageSize = pageSizes[currentPage - 1] || {
//                             width: 595,
//                             height: 842,
//                           };
//                           const scale = 1.5; // Same as in PDFViewer
//                           const displayWidth = pageSize.width * scale;
//                           const centerX = (displayWidth - canvas.width) / 2;
//                           const topY = 50;
//                           // Add as image box
//                           const id = Date.now();
//                           const newBox = {
//                             id,
//                             file,
//                             url,
//                             x: centerX,
//                             y: topY,
//                             width: canvas.width,
//                             height: canvas.height,
//                             page: currentPage,
//                             rotation: 0,
//                           };
//                           setImageBoxes((prev) => [...prev, newBox]);
//                         });
//                       }
//                       setShowNameModal(false);
//                       setSignatureName("");
//                     }}
//                     style={{
//                       padding: "10px 20px",
//                       background: "#456882",
//                       color: "white",
//                       border: "none",
//                       borderRadius: "4px",
//                       cursor: "pointer",
//                     }}
//                   >
//                     OK
//                   </button>
//                   <button
//                     onClick={() => {
//                       setShowNameModal(false);
//                       setSignatureName("");
//                     }}
//                     style={{
//                       padding: "10px 20px",
//                       background: "#8C9491",
//                       color: "white",
//                       border: "none",
//                       borderRadius: "4px",
//                       cursor: "pointer",
//                     }}
//                   >
//                     Cancel
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}
//         </>
//       )}
//     </div>
//   );
// }

// export default PDFEditor;

import { useMemo, useState, useRef, useEffect } from "react";
import { PDFDocument, rgb, StandardFonts, degrees, BlendMode } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import axios from "axios";
import PDFViewer from "./PDFViewer";
import Toolbar from "./Toolbar";
import "./PDFEditor.css";

const formatTsIst = (ts) => {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  const s = d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${s} IST`;
};

function PDFEditor({ token, onLogout, currentUser }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [recentDocs, setRecentDocs] = useState([]);
  const profileMenuRef = useRef(null);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [docId, setDocId] = useState(null);
  const [embeddedSigning, setEmbeddedSigning] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [gitEnabled, setGitEnabled] = useState(false);
  const [gitSignatureOk, setGitSignatureOk] = useState(null);
  const [gitInitLoading, setGitInitLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [editMode, setEditMode] = useState(null);
  const [textContent, setTextContent] = useState("");
  const [fontSize, setFontSize] = useState(16);
  // Use a stable "font key" (mapped to CSS + PDF fonts)
  const [fontFamily, setFontFamily] = useState("helvetica");
  const [textBoxes, setTextBoxes] = useState([]); // Active text boxes on canvas
  const [imageBoxes, setImageBoxes] = useState([]); // Active image boxes on canvas
  const [textSelections, setTextSelections] = useState([]); // Text selections for highlighting
  const [rectangleBoxes, setRectangleBoxes] = useState([]); // Editable rectangle overlays
  const [circleBoxes, setCircleBoxes] = useState([]); // Editable circle/ellipse overlays
  const [lineBoxes, setLineBoxes] = useState([]); // Editable line overlays
  const [undoStack, setUndoStack] = useState([]);
  const fileInputRef = useRef(null);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [selectedRectangleId, setSelectedRectangleId] = useState(null);
  const [selectedCircleId, setSelectedCircleId] = useState(null);
  const [selectedLineId, setSelectedLineId] = useState(null);
  const imageInputRef = useRef(null);
  const [autoFocusTextBoxId, setAutoFocusTextBoxId] = useState(null);
  const fontBytesCacheRef = useRef(new Map());
  const ocrCacheRef = useRef(new Map());
  const applyingTextHighlightRef = useRef(false);
  const pendingGitActionsRef = useRef([]);

  // Multiply keeps black pixels black while tinting light pixels yellow.
  const TEXT_HIGHLIGHT_OPACITY = 1.0;
  const TEXT_HIGHLIGHT_BLEND_MODE = BlendMode.Multiply;

  // Conversion feature states
  const [convertPdfFile, setConvertPdfFile] = useState(null);
  const [convertImageFiles, setConvertImageFiles] = useState([]);
  const [mergePdfFiles, setMergePdfFiles] = useState([]);
  const [pptFile, setPptFile] = useState(null);
  const [lockPdfFile, setLockPdfFile] = useState(null);
  const [lockPassword, setLockPassword] = useState("");
  const [unlockPdfFile, setUnlockPdfFile] = useState(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [watermarkPdfFile, setWatermarkPdfFile] = useState(null);
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
  const [converting, setConverting] = useState(false);
  const convertPdfInputRef = useRef(null);
  const convertImageInputRef = useRef(null);
  const mergePdfInputRef = useRef(null);
  const pptInputRef = useRef(null);
  const lockPdfInputRef = useRef(null);
  const unlockPdfInputRef = useRef(null);
  const watermarkPdfInputRef = useRef(null);

  // Signing states
  const [signingPdfFile, setSigningPdfFile] = useState(null);
  const [signingMode, setSigningMode] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingCanvas, setDrawingCanvas] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [signatureFontSize, setSignatureFontSize] = useState(30);
  const [pageSizes, setPageSizes] = useState([]);
  const signPdfInputRef = useRef(null);
  const drawingCanvasRef = useRef(null);
  const signaturePreviewRef = useRef(null);
  // const signaturePreviewRef = useRef(null);
  const cursiveFontLoadedRef = useRef(false);

  useEffect(() => {
    if (drawingMode && drawingCanvasRef.current) {
      const canvas = drawingCanvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  }, [drawingMode]);

  // Load Dancing Script font when the name modal opens
  useEffect(() => {
    if (!showNameModal) return;
    if (cursiveFontLoadedRef.current) return;
    const loadFont = async () => {
      try {
        // Inject Google Fonts link if not already present
        const linkId = "dancing-script-font-link";
        if (!document.getElementById(linkId)) {
          const link = document.createElement("link");
          link.id = linkId;
          link.rel = "stylesheet";
          link.href =
            "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;600;700&display=swap";
          document.head.appendChild(link);
        }
        // Wait for the font to be ready for canvas rendering
        await document.fonts.load('700 60px "Dancing Script"');
        cursiveFontLoadedRef.current = true;
      } catch (e) {
        console.warn("Could not load Dancing Script font:", e);
      }
    };
    loadFont();
  }, [showNameModal]);

  // Draw live cursive preview whenever the signature name changes
  useEffect(() => {
    if (!showNameModal || !signaturePreviewRef.current) return;
    const canvas = signaturePreviewRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const name = signatureName.trim();
    if (!name) return;

    const drawPreview = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '700 52px "Dancing Script", cursive';
      ctx.fillStyle = "#000000";
      ctx.fillText(name, 16, 66);
    };

    // If font already loaded draw immediately, otherwise wait
    if (cursiveFontLoadedRef.current) {
      drawPreview();
    } else {
      document.fonts
        .load('700 52px "Dancing Script"')
        .then(() => {
          cursiveFontLoadedRef.current = true;
          drawPreview();
        })
        .catch(() => drawPreview()); // fallback to system cursive
    }
  }, [signatureName, showNameModal]);

  const api = useMemo(() => {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
    return axios.create({
      baseURL: `${API_URL}/api`,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }, [token]);

  const getApiErrorMessage = async (error, fallback) => {
    try {
      const data = error?.response?.data;
      if (!data) return fallback;

      // If axios was configured with responseType: 'blob', error payload will be a Blob.
      if (typeof Blob !== "undefined" && data instanceof Blob) {
        const text = await data.text().catch(() => "");
        if (!text) return fallback;
        try {
          const json = JSON.parse(text);
          return json?.error || fallback;
        } catch {
          return text;
        }
      }

      if (typeof data === "string") return data;
      return data?.error || fallback;
    } catch {
      return fallback;
    }
  };

  const fetchRecentDocs = async () => {
    try {
      const res = await api.get("/documents");
      const docs = res.data.documents || [];

      // Removed the grouping by name so all edits to the same or different files
      // are visible, limited to the 5 most recent items. They are ordered by recently updated by the backend.
      setRecentDocs(docs.slice(0, 5));
    } catch (e) {
      console.error("Failed to fetch recent docs", e);
    }
  };

  const handleSignPdfSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setSigningPdfFile(file);
    setSigningMode(true);
    setLoadingPdf(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      setPdfDoc(pdfDoc);
      setPdfFile(URL.createObjectURL(file));
      setTotalPages(pdfDoc.getPageCount());
      setCurrentPage(1);
      // Get page sizes
      const sizes = [];
      for (let i = 0; i < pdfDoc.getPageCount(); i++) {
        const page = pdfDoc.getPage(i);
        const { width, height } = page.getSize();
        sizes.push({ width, height });
      }
      setPageSizes(sizes);
      // Reset boxes for signing
      setTextBoxes([]);
      setImageBoxes([]);
      setRectangleBoxes([]);
      setCircleBoxes([]);
      setLineBoxes([]);
      setTextSelections([]);
      setUndoStack([]);
      setEditMode(null);
    } catch (error) {
      console.error("Error loading PDF for signing:", error);
      alert("Error loading PDF for signing");
    } finally {
      setLoadingPdf(false);
    }
  };

  useEffect(() => {
    fetchRecentDocs();
  }, [token]);

  useEffect(() => {
    const id = api.interceptors.response.use(
      (resp) => resp,
      (err) => {
        const status = err?.response?.status;
        if (status === 401) {
          alert("Session expired or invalid. Please login again.");
          if (onLogout) onLogout();
        }
        return Promise.reject(err);
      },
    );
    return () => api.interceptors.response.eject(id);
  }, [api, onLogout]);

  // Load document from URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const docIdParam = params.get("doc");
    if (docIdParam && !pdfFile) {
      const loadDoc = async () => {
        try {
          setLoadingPdf(true);
          const downloadRes = await api.get(
            `/documents/${docIdParam}/download`,
            { responseType: "arraybuffer" },
          );
          const bytes = downloadRes.data;
          const blob = new Blob([bytes], { type: "application/pdf" });
          const arrayBuffer = await blob.arrayBuffer();
          const pdf = await PDFDocument.load(arrayBuffer);

          setDocId(docIdParam);
          setPdfDoc(pdf);
          const newUrl = URL.createObjectURL(blob);
          setPdfFile(newUrl);
          setTotalPages(pdf.getPageCount());
          setCurrentPage(1);
        } catch (err) {
          console.error(err);
          alert(
            "Failed to load document. Note: Only the document creator can view this PDF.",
          );
        } finally {
          setLoadingPdf(false);
        }
      };
      loadDoc();
    }
  }, [api, pdfFile]);

  // Fetch embedded PDF Git status for the current doc
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!docId) {
        setGitEnabled(false);
        setGitSignatureOk(null);
        return;
      }
      try {
        const res = await api.get(`/documents/${docId}/git`);
        if (cancelled) return;
        const enabled = !!res.data?.enabled;
        setGitEnabled(enabled);
        if (!enabled) {
          setGitSignatureOk(null);
        } else {
          const sigOk = res.data?.signature?.ok;
          setGitSignatureOk(typeof sigOk === "boolean" ? sigOk : null);
        }
      } catch {
        if (cancelled) return;
        setGitEnabled(false);
        setGitSignatureOk(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [api, docId]);

  useEffect(() => {
    ocrCacheRef.current.clear();
  }, [docId]);

  const goHome = () => {
    // Remove any document-specific URL param so refresh doesn't reload the doc.
    const params = new URLSearchParams(window.location.search);
    params.delete("doc");
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.pushState({}, "", next);

    // Revoke current blob URL to avoid memory leaks.
    if (pdfFile && String(pdfFile).startsWith("blob:")) {
      try {
        URL.revokeObjectURL(pdfFile);
      } catch {
        // ignore
      }
    }

    // Reset editor state back to the upload/home screen.
    setPdfFile(null);
    setPdfDoc(null);
    setDocId(null);
    setEmbeddedSigning(false);
    setUploadingPdf(false);
    setLoadingPdf(false);
    setCurrentPage(1);
    setTotalPages(0);
    setGitEnabled(false);
    setGitSignatureOk(null);
    setEditMode(null);
    setTextContent("");
    setTextBoxes([]);
    setImageBoxes([]);
    setTextSelections([]);
    setRectangleBoxes([]);
    setCircleBoxes([]);
    setLineBoxes([]);
    setUndoStack([]);
    setSelectedTextId(null);
    setSelectedRectangleId(null);
    setSelectedCircleId(null);
    setSelectedLineId(null);
    setAutoFocusTextBoxId(null);
    setSigningPdfFile(null);
    setSigningMode(false);
    setDrawingMode(false);
    setDrawingCanvas(null);
    setShowNameModal(false);
    setSignatureName("");
    setPageSizes([]);

    pendingGitActionsRef.current = [];
  };

  const fetchOcrForPage = async (pageNumber) => {
    if (!docId) return null;
    const key = `${docId}:${pageNumber}`;
    if (ocrCacheRef.current.has(key)) return ocrCacheRef.current.get(key);
    const res = await api.get(`/documents/${docId}/ocr`, {
      params: { page: pageNumber },
    });
    ocrCacheRef.current.set(key, res.data);
    return res.data;
  };

  // Deselect overlays when clicking outside boxes + toolbars
  useEffect(() => {
    if (
      selectedTextId == null &&
      selectedRectangleId == null &&
      selectedCircleId == null &&
      selectedLineId == null
    ) {
      return;
    }

    const handleGlobalMouseDown = (e) => {
      const el =
        e.target instanceof Element ? e.target : e.target?.parentElement;
      if (!el) return;

      // Keep selection when interacting with text boxes or toolbars
      if (
        el.closest(".text-box") ||
        el.closest(".rect-box") ||
        el.closest(".circle-box") ||
        el.closest(".line-box") ||
        el.closest(".secondary-toolbar") ||
        el.closest(".toolbar")
      ) {
        return;
      }

      setSelectedTextId(null);
      setSelectedRectangleId(null);
      setSelectedCircleId(null);
      setSelectedLineId(null);
    };

    document.addEventListener("mousedown", handleGlobalMouseDown);
    return () =>
      document.removeEventListener("mousedown", handleGlobalMouseDown);
  }, [selectedTextId, selectedRectangleId, selectedCircleId, selectedLineId]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    try {
      const name = String(file?.name || "").toLowerCase();
      const type = String(file?.type || "").toLowerCase();
      const looksLikePdf = name.endsWith(".pdf") || type.includes("pdf");
      if (!file || !looksLikePdf) {
        alert("Please upload a valid PDF file");
        return;
      }

      setUploadingPdf(true);

      // Secure workflow: upload to backend (sanitize + encrypt at rest), then download sanitized PDF for editing.
      const formData = new FormData();
      formData.append("pdf", file);
      const createRes = await api.post("/documents", formData);

      const id = createRes.data?.id;
      if (!id) throw new Error("Upload failed: missing document id");

      const downloadRes = await api.get(`/documents/${id}/download`, {
        responseType: "arraybuffer",
      });
      const bytes = downloadRes.data;
      const blob = new Blob([bytes], { type: "application/pdf" });

      const arrayBuffer = await blob.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      setPdfDoc(pdf);
      const oldUrl = pdfFile;
      const newUrl = URL.createObjectURL(blob);
      setPdfFile(newUrl);
      if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 100);

      setDocId(id);
      setTotalPages(pdf.getPageCount());
      setCurrentPage(1);
      setGitEnabled(false);
      setGitSignatureOk(null);
      setUndoStack([]);
      setTextBoxes([]);
      setImageBoxes([]);
      setTextSelections([]);
      setRectangleBoxes([]);
      setCircleBoxes([]);
      setLineBoxes([]);
      setEditMode(null);
      setSelectedTextId(null);
      setSelectedRectangleId(null);
      setSelectedCircleId(null);
      setSelectedLineId(null);
      fetchRecentDocs();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || e.message || "Failed to upload PDF");
    } finally {
      setUploadingPdf(false);
      // Reset input so re-uploading same file triggers change
      event.target.value = "";
    }
  };

  const handleGitInit = async () => {
    if (gitInitLoading) return;
    try {
      if (!docId) {
        alert("No document loaded");
        return;
      }

      setGitInitLoading(true);
      const res = await api.post(`/documents/${docId}/git/init`);
      const newId = res.data?.id;
      if (!newId) throw new Error("Init failed");

      const downloadRes = await api.get(`/documents/${newId}/download`, {
        responseType: "arraybuffer",
      });
      const bytes = downloadRes.data;
      const blob = new Blob([bytes], { type: "application/pdf" });
      const arrayBuffer = await blob.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);

      setDocId(newId);
      setPdfDoc(pdf);
      const oldUrl = pdfFile;
      const newUrl = URL.createObjectURL(blob);
      setPdfFile(newUrl);
      if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 100);

      setTotalPages(pdf.getPageCount());
      setCurrentPage(1);
      setUndoStack([]);
      setTextBoxes([]);
      setImageBoxes([]);
      setTextSelections([]);
      setRectangleBoxes([]);
      setCircleBoxes([]);
      setLineBoxes([]);
      setEditMode(null);
      setSelectedTextId(null);
      setSelectedRectangleId(null);
      setSelectedCircleId(null);
      setSelectedLineId(null);
      alert("PDF Git initialized and embedded into the PDF");
    } catch (e) {
      console.error(e);
      alert(
        e?.response?.data?.error || e.message || "Failed to initialize PDF Git",
      );
    } finally {
      setGitInitLoading(false);
    }
  };

  const formatGitHistory = (git) => {
    if (!git?.head || !git?.commits) return "No history";
    const lines = [];
    const headShort = String(git.head).slice(0, 8);
    lines.push(`Repo: ${git.repoId || "unknown"}`);
    lines.push(`HEAD -> main (${headShort})`);
    lines.push("");

    const seen = new Set();
    let cur = git.head;
    let n = 0;
    while (cur && git.commits[cur] && !seen.has(cur) && n < 30) {
      seen.add(cur);
      const c = git.commits[cur];
      const actor = c.actor?.email || c.actor?.id || "unknown";
      const short = String(c.id || cur).slice(0, 8);
      lines.push(`o ${short}  ${c.message}`);
      lines.push(`|  ${formatTsIst(c.ts)}  by ${actor}`);
      if (Array.isArray(c.actions) && c.actions.length > 0) {
        for (const a of c.actions.slice(0, 8)) {
          const page = a.page ? ` page=${a.page}` : "";
          const txt = a.text
            ? ` text=${JSON.stringify(String(a.text).slice(0, 80))}`
            : "";
          const extras = Object.entries(a || {})
            .filter(([k, v]) => !["type", "page", "text"].includes(k) && v != null)
            .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
            .join(" ");
          lines.push(
            `|  - ${a.type}${page}${txt}${extras ? ` ${extras}` : ""}`,
          );
        }
        if (c.actions.length > 8) lines.push("  - ...");
      }
      lines.push("|");
      cur = c.parent;
      n++;
    }
    return lines.join("\n");
  };

  const buildGitActionsForSave = () => {
    const actions = [];

    // Actions that are applied directly onto the PDF (not represented as overlays)
    // are tracked in this ref.
    if (Array.isArray(pendingGitActionsRef.current)) {
      actions.push(...pendingGitActionsRef.current);
    }

    const validTextBoxes = (textBoxes || []).filter((b) => (b.text || "").trim());
    for (const b of validTextBoxes) {
      actions.push({
        type: "text",
        page: b.page,
        text: String(b.text || "").slice(0, 120),
      });
    }

    for (const b of imageBoxes || []) {
      actions.push({ type: "image", page: b.page });
    }

    for (const s of textSelections || []) {
      actions.push({
        type: "highlight",
        page: s.page,
        count: Array.isArray(s.rects) ? s.rects.length : 0,
      });
    }

    for (const b of rectangleBoxes || []) {
      actions.push({ type: b?.filled ? "filled-rect" : "rect", page: b.page });
    }
    for (const b of circleBoxes || []) {
      actions.push({ type: b?.filled ? "filled-circle" : "circle", page: b.page });
    }
    for (const b of lineBoxes || []) {
      actions.push({ type: "line", page: b.page });
    }

    return actions;
  };

  const handleGitHistory = async (historyWindow) => {
    if (!docId) {
      alert("No document loaded");
      return;
    }

    // Prefer a window opened synchronously by the click handler.
    const w = historyWindow || window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;

    const writePage = ({ title, subtitle, body }) => {
      const safeTitle = String(title || "PDF Git")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const safeSubtitle = String(subtitle || "")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const safeBody = String(body || "")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      w.document.open();
      w.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      :root { color-scheme: light dark; }
      body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
      header { padding: 16px 18px; border-bottom: 1px solid rgba(127,127,127,0.25); }
      h1 { margin: 0; font-size: 18px; }
      .sub { margin-top: 6px; opacity: 0.8; font-size: 13px; }
      main { padding: 16px 18px; }
      pre { white-space: pre-wrap; word-break: break-word; line-height: 1.35; font-size: 13px; }
      .hint { opacity: 0.75; font-size: 12px; margin-top: 12px; }
    </style>
  </head>
  <body>
    <header>
      <h1>${safeTitle}</h1>
      ${safeSubtitle ? `<div class="sub">${safeSubtitle}</div>` : ""}
    </header>
    <main>
      <pre>${safeBody}</pre>
      <div class="hint">This view is generated by TEB from embedded PDF metadata.</div>
    </main>
  </body>
</html>`);
      w.document.close();
    };

    writePage({
      title: "PDF Git — History tree",
      subtitle: `Document: ${docId}`,
      body: "Loading…",
    });

    try {
      const res = await api.get(`/documents/${docId}/git`);
      if (!res.data?.enabled) {
        writePage({
          title: "PDF Git — History tree",
          subtitle: `Document: ${docId}`,
          body: "PDF Git is not initialized for this PDF.",
        });
        return;
      }

      const sig = res.data?.signature;
      const sigLine =
        typeof sig?.ok === "boolean"
          ? `Signature: ${sig.ok ? "OK" : "FAIL"}${sig.error ? ` (${sig.error})` : ""}`
          : "Signature: unknown";

      writePage({
        title: "PDF Git — History tree",
        subtitle: `${sigLine}`,
        body: formatGitHistory(res.data.git),
      });
    } catch (e) {
      console.error(e);
      writePage({
        title: "PDF Git — History tree",
        subtitle: `Document: ${docId}`,
        body:
          e?.response?.data?.error ||
          e.message ||
          "Failed to load PDF Git history",
      });
    }
  };

  const handleGitVerify = async () => {
    try {
      if (!docId) {
        alert("No document loaded");
        return;
      }
      const res = await api.get(`/documents/${docId}/git/verify`);
      const ok = !!res.data?.ok;
      const modified = Array.isArray(res.data?.modifiedPages)
        ? res.data.modifiedPages
        : [];
      const pageHashSkipped = !!res.data?.pageHashCheck?.skipped;
      const pageHashReason =
        typeof res.data?.pageHashCheck?.reason === "string"
          ? res.data.pageHashCheck.reason
          : null;
      const sigOk = res.data?.signature?.ok;
      const sigMsg =
        typeof sigOk === "boolean"
          ? `Signature: ${sigOk ? "OK" : "FAIL"}`
          : "Signature: unknown";
      if (ok) {
        if (pageHashSkipped) {
          alert(
            `PDF Git verification OK (signature only)\n${sigMsg}\nPage tamper check skipped: ${pageHashReason || "unavailable"}`,
          );
        } else {
          alert(`PDF Git verification OK\n${sigMsg}`);
        }
      } else {
        alert(
          `PDF was modified outside authorized flow\nModified pages: ${modified.join(", ") || "unknown"}\n${sigMsg}`,
        );
      }
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || e.message || "Verification failed");
    }
  };

  // Handle clicking on PDF to add text box
  const handleAddTextBox = (coords) => {
    if (editMode !== "text") return;

    const pdfScaleFactor =
      typeof coords.pdfScaleFactor === "number" &&
      Number.isFinite(coords.pdfScaleFactor)
        ? coords.pdfScaleFactor
        : 1 / 1.5;

    const pdfFontSize = fontSize * pdfScaleFactor;

    const newTextBox = {
      id: Date.now(),
      text: "", // Empty initially - user types directly in the box
      displayX: coords.displayX, // For CSS positioning
      displayY: coords.displayY,
      pdfX: coords.pdfX, // For PDF drawing
      pdfY: coords.pdfY,
      fontSize: fontSize,
      pdfFontSize,
      pdfScaleFactor,
      fontFamily: fontFamily,
      fontWeight: "normal",
      fontStyle: "normal",
      color: "#000000",
      page: currentPage,
    };

    setTextBoxes((prev) => [...prev, newTextBox]);
    setSelectedTextId(newTextBox.id);
    setAutoFocusTextBoxId(newTextBox.id);

    // Return cursor to normal after placing one text box
    setEditMode(null);
  };

  // Update text box position when dragged
  const handleUpdateTextBox = (id, updates) => {
    setTextBoxes(
      textBoxes.map((box) => {
        if (box.id === id) {
          // If updating position, only update display coordinates
          // PDF coordinates will be recalculated when applying
          if (
            updates.displayX !== undefined ||
            updates.displayY !== undefined
          ) {
            return { ...box, ...updates };
          }
          // For text content updates
          return { ...box, ...updates };
        }
        return box;
      }),
    );
  };

  // Remove a text box
  const handleRemoveTextBox = (id) => {
    setTextBoxes(textBoxes.filter((box) => box.id !== id));
  };

  // Handle image upload
  // Handle image upload
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // PROPERLY maintain aspect ratio on initial load
          let defaultWidth = img.width;
          let defaultHeight = img.height;
          const MAX_DIM = 300;

          if (defaultWidth > MAX_DIM || defaultHeight > MAX_DIM) {
            const ratio = Math.min(
              MAX_DIM / defaultWidth,
              MAX_DIM / defaultHeight,
            );
            defaultWidth = Math.round(defaultWidth * ratio);
            defaultHeight = Math.round(defaultHeight * ratio);
          }

          const imageBox = {
            id: Date.now(),
            imageData: e.target.result,
            displayX: 100,
            displayY: 100,
            pdfX: 100,
            pdfY: 100,
            pdfWidth: null,
            pdfHeight: null,
            width: defaultWidth,
            height: defaultHeight,
            originalWidth: img.width,
            originalHeight: img.height,
            page: currentPage,
            fileType: file.type,
          };
          setImageBoxes([...imageBoxes, imageBox]);
          setEditMode("image");
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      alert("Please select a valid image file (PNG, JPG, etc.)");
    }
    event.target.value = "";
  };

  // Update image box position or size
  // Update image box position or size
  // Update image box position or size
  const handleUpdateImageBox = (id, updates) => {
    setImageBoxes((prevBoxes) =>
      prevBoxes.map((box) => {
        if (box.id === id) {
          let nextUpdates = { ...updates };

          // If size is being updated, check the minimum thresholds safely
          if (
            nextUpdates.width !== undefined ||
            nextUpdates.height !== undefined
          ) {
            let newWidth =
              nextUpdates.width !== undefined ? nextUpdates.width : box.width;
            let newHeight =
              nextUpdates.height !== undefined
                ? nextUpdates.height
                : box.height;
            const originalRatio = box.originalWidth / box.originalHeight;

            // Enforce minimums while strictly preserving original aspect ratio
            if (newWidth < 30 || newHeight < 30) {
              if (newWidth < 30) {
                newWidth = 30;
                newHeight = 30 / originalRatio;
              }
              // Re-check height in case the aspect ratio made the height too small
              if (newHeight < 30) {
                newHeight = 30;
                newWidth = 30 * originalRatio;
              }

              nextUpdates.width = newWidth;
              nextUpdates.height = newHeight;
            }
          }

          return { ...box, ...nextUpdates };
        }
        return box;
      }),
    );
  };

  // Remove an image box
  const handleRemoveImageBox = (id) => {
    setImageBoxes(imageBoxes.filter((box) => box.id !== id));
  };

  // Apply images to PDF
  const handleApplyImages = async () => {
    if (imageBoxes.length === 0) {
      alert("No images to apply");
      return;
    }

    await saveToUndoStack();

    const pages = pdfDoc.getPages();

    // Group images by page
    const imagesByPage = {};
    imageBoxes.forEach((box) => {
      if (!imagesByPage[box.page]) {
        imagesByPage[box.page] = [];
      }
      imagesByPage[box.page].push(box);
    });

    // Add images to each page
    for (const [pageNum, images] of Object.entries(imagesByPage)) {
      const page = pages[parseInt(pageNum) - 1];
      const { height: pageHeight } = page.getSize();

      for (const imgBox of images) {
        try {
          // Convert base64 to bytes
          const base64Data = imgBox.imageData.split(",")[1];
          const imageBytes = Uint8Array.from(atob(base64Data), (c) =>
            c.charCodeAt(0),
          );

          // Embed image based on type
          let pdfImage;
          if (imgBox.fileType === "image/png") {
            pdfImage = await pdfDoc.embedPng(imageBytes);
          } else if (
            imgBox.fileType === "image/jpeg" ||
            imgBox.fileType === "image/jpg"
          ) {
            pdfImage = await pdfDoc.embedJpg(imageBytes);
          } else {
            // Try PNG first, fallback to JPG
            try {
              pdfImage = await pdfDoc.embedPng(imageBytes);
            } catch {
              pdfImage = await pdfDoc.embedJpg(imageBytes);
            }
          }

          // Use PDF coordinates for embedding
          const pdfY = pageHeight - imgBox.pdfY - imgBox.height;

          page.drawImage(pdfImage, {
            x: imgBox.pdfX,
            y: pdfY,
            width: imgBox.width,
            height: imgBox.height,
          });
        } catch (error) {
          console.error("Error embedding image:", error);
          alert(`Failed to embed image. Error: ${error.message}`);
        }
      }
    }

    await refreshPDF();
    setImageBoxes([]);
    setEditMode(null);
  };

  // Handle text selection for highlighting
  const handleTextSelection = async (selection) => {
    if (editMode !== "highlight-select") return;
    if (!pdfDoc) return;
    if (
      !selection ||
      !Array.isArray(selection.rects) ||
      selection.rects.length === 0
    )
      return;
    if (applyingTextHighlightRef.current) return;

    applyingTextHighlightRef.current = true;
    try {
      await saveToUndoStack();

      const sel = {
        ...selection,
        id: Date.now(),
        page: currentPage,
      };

      await applyTextSelectionsToPdf(pdfDoc, [sel]);
      await refreshPDF();
      setTextSelections([]);
    } finally {
      applyingTextHighlightRef.current = false;
    }
  };

  // Apply text selection highlights to PDF
  const handleApplyHighlights = async () => {
    if (textSelections.length === 0) {
      alert("No text selections to highlight");
      return;
    }

    await saveToUndoStack();

    const pages = pdfDoc.getPages();

    // Group selections by page
    const selectionsByPage = {};
    textSelections.forEach((sel) => {
      if (!selectionsByPage[sel.page]) {
        selectionsByPage[sel.page] = [];
      }
      selectionsByPage[sel.page].push(sel);
    });

    // Add highlights to each page
    for (const [pageNum, selections] of Object.entries(selectionsByPage)) {
      const page = pages[parseInt(pageNum) - 1];
      const { height: pageHeight } = page.getSize();

      selections.forEach((sel) => {
        sel.rects.forEach((rect) => {
          const pdfY = pageHeight - rect.y - rect.height;
          page.drawRectangle({
            x: rect.x,
            y: pdfY,
            width: rect.width,
            height: rect.height,
            color: rgb(1, 1, 0),
            opacity: TEXT_HIGHLIGHT_OPACITY,
            blendMode: TEXT_HIGHLIGHT_BLEND_MODE,
          });
        });
      });
    }

    await refreshPDF();
    setTextSelections([]);
    setEditMode(null);
  };

  // Remove a text selection
  const handleRemoveSelection = (id) => {
    setTextSelections(textSelections.filter((sel) => sel.id !== id));
  };

  // Apply text boxes to PDF
  // const handleApplyText = async () => {
  //   // Filter out empty text boxes
  //   const validBoxes = textBoxes.filter(box => box.text.trim())

  //   if (validBoxes.length === 0) {
  //     alert('Please add some text to the text boxes')
  //     return
  //   }

  //   await saveToUndoStack()

  //   const pages = pdfDoc.getPages()
  //   const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  //   // Group text boxes by page
  //   const boxesByPage = {}
  //   validBoxes.forEach(box => {
  //     if (!boxesByPage[box.page]) {
  //       boxesByPage[box.page] = []
  //     }
  //     boxesByPage[box.page].push(box)
  //   })

  //   // Add text to each page
  //   for (const [pageNum, boxes] of Object.entries(boxesByPage)) {
  //     const page = pages[parseInt(pageNum) - 1]
  //     const { height: pageHeight } = page.getSize()

  //     boxes.forEach(box => {
  //       // Use PDF coordinates that were calculated when placing the text box
  //       const pdfY = pageHeight - box.pdfY - box.fontSize
  //       page.drawText(box.text, {
  //         x: box.pdfX,
  //         y: pdfY,
  //         size: box.fontSize,
  //         font: font,
  //         color: rgb(0, 0, 0)
  //       })
  //     })
  //   }

  //   await refreshPDF()
  //   setTextBoxes([])
  //   setEditMode(null)
  // }

  const getFontBytes = async (url) => {
    if (!url) return null;
    const cache = fontBytesCacheRef.current;
    if (cache.has(url)) return cache.get(url);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load font: ${url}`);
    }
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    cache.set(url, bytes);
    return bytes;
  };

  const getCustomFontUrl = (fontKey) => {
    switch (fontKey) {
      case "inter":
        return "/fonts/Inter.ttf";
      case "lato":
        return "/fonts/Lato-Regular.ttf";
      case "poppins":
        return "/fonts/Poppins-Regular.ttf";
      case "oswald":
        return "/fonts/Oswald.ttf";
      case "roboto-condensed":
        return "/fonts/RobotoCondensed-Regular.ttf";
      case "signature":
        return "https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSo3Rep8h-4EeNmE9KQHBY.ttf";
      default:
        return null;
    }
  };

  const parseHexColorToRgb = (hex) => {
    if (typeof hex !== "string") return rgb(0, 0, 0);
    const raw = hex.trim();
    if (!raw.startsWith("#")) return rgb(0, 0, 0);
    const h = raw.slice(1);
    let r, g, b;
    if (h.length === 3) {
      r = parseInt(h[0] + h[0], 16);
      g = parseInt(h[1] + h[1], 16);
      b = parseInt(h[2] + h[2], 16);
    } else if (h.length === 6) {
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
    } else {
      return rgb(0, 0, 0);
    }

    if (![r, g, b].every((n) => Number.isFinite(n))) return rgb(0, 0, 0);
    return rgb(r / 255, g / 255, b / 255);
  };

  const getStandardFontName = (fontKey, isBold, isItalic) => {
    if (fontKey === "helvetica") {
      if (isBold && isItalic) return StandardFonts.HelveticaBoldOblique;
      if (isBold) return StandardFonts.HelveticaBold;
      if (isItalic) return StandardFonts.HelveticaOblique;
      return StandardFonts.Helvetica;
    }

    if (fontKey === "times") {
      if (isBold && isItalic) return StandardFonts.TimesRomanBoldItalic;
      if (isBold) return StandardFonts.TimesRomanBold;
      if (isItalic) return StandardFonts.TimesRomanItalic;
      return StandardFonts.TimesRoman;
    }

    if (fontKey === "courier") {
      if (isBold && isItalic) return StandardFonts.CourierBoldOblique;
      if (isBold) return StandardFonts.CourierBold;
      if (isItalic) return StandardFonts.CourierOblique;
      return StandardFonts.Courier;
    }

    return StandardFonts.Helvetica;
  };

  const normalizeFontKey = (value) => {
    if (!value) return "helvetica";

    // Already normalized
    if (
      value === "helvetica" ||
      value === "times" ||
      value === "courier" ||
      value === "roboto-condensed" ||
      value === "oswald" ||
      value === "inter" ||
      value === "poppins" ||
      value === "lato"
    ) {
      return value;
    }

    // Legacy / display values
    if (value === "Helvetica") return "helvetica";
    if (value === "TimesRoman" || value === "Times") return "times";
    if (value === "Courier") return "courier";
    if (value === "Roboto Condensed" || value === "RobotoCondensed")
      return "roboto-condensed";
    if (value === "Oswald") return "oswald";
    if (value === "Inter") return "inter";
    if (value === "Poppins") return "poppins";
    if (value === "Lato") return "lato";

    return "helvetica";
  };

  const applyTextBoxesToPdf = async (doc, boxesToApply) => {
    if (!doc || !boxesToApply || boxesToApply.length === 0) return;

    const pages = doc.getPages();
    const embeddedFontCache = new Map();
    const fontkitInstance = fontkit?.default ?? fontkit;

    // Group text boxes by page
    const boxesByPage = {};
    boxesToApply.forEach((box) => {
      if (!boxesByPage[box.page]) {
        boxesByPage[box.page] = [];
      }
      boxesByPage[box.page].push(box);
    });

    for (const [pageNum, boxes] of Object.entries(boxesByPage)) {
      const page = pages[parseInt(pageNum) - 1];
      const { height } = page.getSize();

      for (const box of boxes) {
        let font;
        const fontKey = normalizeFontKey(box.fontFamily);
        const isBold =
          (box.fontWeight ?? "normal") === "bold" || box.isBold === true;
        const isItalic =
          (box.fontStyle ?? "normal") === "italic" || box.isItalic === true;

        const isStandard =
          fontKey === "helvetica" ||
          fontKey === "times" ||
          fontKey === "courier";
        const fontCacheKey = isStandard
          ? `${fontKey}:${isBold ? "b" : ""}${isItalic ? "i" : ""}`
          : fontKey;

        if (embeddedFontCache.has(fontCacheKey)) {
          font = embeddedFontCache.get(fontCacheKey);
        } else {
          if (isStandard) {
            const stdFontName = getStandardFontName(fontKey, isBold, isItalic);
            font = await doc.embedFont(stdFontName);
          } else {
            // Embed a real TTF for export so the downloaded PDF matches the editor.
            // Bold/italic for custom fonts is handled via a simple PDF fallback (see below).
            const fontUrl = getCustomFontUrl(fontKey);
            if (!fontUrl || !fontkitInstance) {
              font = await doc.embedFont(StandardFonts.Helvetica);
            } else {
              try {
                doc.registerFontkit(fontkitInstance);
                const fontBytes = await getFontBytes(fontUrl);
                font = await doc.embedFont(fontBytes, { subset: true });
              } catch {
                font = await doc.embedFont(StandardFonts.Helvetica);
              }
            }
          }
          embeddedFontCache.set(fontCacheKey, font);
        }

        const pdfFontSize =
          typeof box.pdfFontSize === "number" &&
          Number.isFinite(box.pdfFontSize)
            ? box.pdfFontSize
            : box.fontSize;

        // Match on-screen positioning:
        // - The on-screen text starts *inside* the text box due to CSS padding.
        // - pdf-lib draws from the baseline, not from the top.
        const pdfScaleFactor =
          typeof box.pdfScaleFactor === "number" &&
          Number.isFinite(box.pdfScaleFactor)
            ? box.pdfScaleFactor
            : 1 / 1.5;

        const paddingLeftPx = 12;
        const paddingTopPx = 8;

        const pdfTextX = box.pdfX + paddingLeftPx * pdfScaleFactor;
        const pdfTextTop = box.pdfY + paddingTopPx * pdfScaleFactor;

        // Use ascent (exclude descender) to align top better.
        let ascentHeight = pdfFontSize;
        if (typeof font?.heightAtSize === "function") {
          try {
            ascentHeight = font.heightAtSize(pdfFontSize, { descender: false });
          } catch {
            ascentHeight = font.heightAtSize(pdfFontSize);
          }
        }

        const pdfY = height - pdfTextTop - ascentHeight;

        const textColor = parseHexColorToRgb(box.color);

        const shouldFakeItalic = !isStandard && isItalic;
        const shouldFakeBold = !isStandard && isBold;

        const drawOptions = {
          x: pdfTextX,
          y: pdfY,
          size: pdfFontSize,
          font,
          color: textColor,
          ...(shouldFakeItalic ? { xSkew: degrees(12) } : {}),
        };

        page.drawText(box.text, drawOptions);
        if (shouldFakeBold) {
          const boldOffset = Math.max(0.25, pdfFontSize * 0.03);
          page.drawText(box.text, {
            ...drawOptions,
            x: pdfTextX + boldOffset,
          });
        }
      }
    }
  };

  const applyImageBoxesToPdf = async (doc, boxesToApply) => {
    if (!doc || !boxesToApply || boxesToApply.length === 0) return;

    const pages = doc.getPages();

    // Group images by page
    const imagesByPage = {};
    boxesToApply.forEach((box) => {
      if (!imagesByPage[box.page]) {
        imagesByPage[box.page] = [];
      }
      imagesByPage[box.page].push(box);
    });

    for (const [pageNum, images] of Object.entries(imagesByPage)) {
      const page = pages[parseInt(pageNum) - 1];
      const { height: pageHeight } = page.getSize();

      for (const imgBox of images) {
        // Convert base64 to bytes
        const base64Data = imgBox.imageData.split(",")[1];
        const imageBytes = Uint8Array.from(atob(base64Data), (c) =>
          c.charCodeAt(0),
        );

        // Embed image based on type
        let pdfImage;
        if (imgBox.fileType === "image/png") {
          pdfImage = await doc.embedPng(imageBytes);
        } else if (
          imgBox.fileType === "image/jpeg" ||
          imgBox.fileType === "image/jpg"
        ) {
          pdfImage = await doc.embedJpg(imageBytes);
        } else {
          // Try PNG first, fallback to JPG
          try {
            pdfImage = await doc.embedPng(imageBytes);
          } catch {
            pdfImage = await doc.embedJpg(imageBytes);
          }
        }

        const pdfWidth =
          typeof imgBox.pdfWidth === "number" &&
          Number.isFinite(imgBox.pdfWidth)
            ? imgBox.pdfWidth
            : imgBox.width;

        const pdfHeight =
          typeof imgBox.pdfHeight === "number" &&
          Number.isFinite(imgBox.pdfHeight)
            ? imgBox.pdfHeight
            : imgBox.height;

        const pdfY = pageHeight - imgBox.pdfY - pdfHeight;
        page.drawImage(pdfImage, {
          x: imgBox.pdfX,
          y: pdfY,
          width: pdfWidth,
          height: pdfHeight,
        });
      }
    }
  };

  const applyTextSelectionsToPdf = async (doc, selectionsToApply) => {
    if (!doc || !selectionsToApply || selectionsToApply.length === 0) return;

    const pages = doc.getPages();

    // Group selections by page
    const selectionsByPage = {};
    selectionsToApply.forEach((sel) => {
      if (!selectionsByPage[sel.page]) {
        selectionsByPage[sel.page] = [];
      }
      selectionsByPage[sel.page].push(sel);
    });

    for (const [pageNum, selections] of Object.entries(selectionsByPage)) {
      const page = pages[parseInt(pageNum) - 1];
      const { height: pageHeight } = page.getSize();

      selections.forEach((sel) => {
        sel.rects.forEach((rect) => {
          const pdfY = pageHeight - rect.y - rect.height;
          page.drawRectangle({
            x: rect.x,
            y: pdfY,
            width: rect.width,
            height: rect.height,
            color: rgb(1, 1, 0),
            opacity: TEXT_HIGHLIGHT_OPACITY,
            blendMode: TEXT_HIGHLIGHT_BLEND_MODE,
          });
        });
      });
    }
  };

  const applyRectangleBoxesToPdf = async (doc, boxesToApply) => {
    if (!doc || !boxesToApply || boxesToApply.length === 0) return;

    const pages = doc.getPages();

    const byPage = {};
    boxesToApply.forEach((b) => {
      if (!byPage[b.page]) byPage[b.page] = [];
      byPage[b.page].push(b);
    });

    for (const [pageNum, boxes] of Object.entries(byPage)) {
      const page = pages[parseInt(pageNum) - 1];
      const { height: pageHeight } = page.getSize();

      for (const box of boxes) {
        const pdfWidth =
          typeof box.pdfWidth === "number" && Number.isFinite(box.pdfWidth)
            ? box.pdfWidth
            : box.width;
        const pdfHeight =
          typeof box.pdfHeight === "number" && Number.isFinite(box.pdfHeight)
            ? box.pdfHeight
            : box.height;

        const pdfY = pageHeight - box.pdfY - pdfHeight;

        const strokeColor = parseHexColorToRgb(box.strokeColor);
        const fillColor = parseHexColorToRgb(box.fillColor);

        const pdfScaleFactor =
          typeof box.pdfScaleFactor === "number" &&
          Number.isFinite(box.pdfScaleFactor)
            ? box.pdfScaleFactor
            : 1 / 1.5;

        const strokeWidth =
          typeof box.strokeWidth === "number" &&
          Number.isFinite(box.strokeWidth)
            ? box.strokeWidth
            : 2;

        const borderWidth = Math.max(0.25, strokeWidth * pdfScaleFactor);

        page.drawRectangle({
          x: box.pdfX,
          y: pdfY,
          width: pdfWidth,
          height: pdfHeight,
          ...(box.filled ? { color: fillColor } : {}),
          borderColor: strokeColor,
          borderWidth,
        });
      }
    }
  };

  const applyCircleBoxesToPdf = async (doc, boxesToApply) => {
    if (!doc || !boxesToApply || boxesToApply.length === 0) return;

    const pages = doc.getPages();

    const byPage = {};
    boxesToApply.forEach((b) => {
      if (!byPage[b.page]) byPage[b.page] = [];
      byPage[b.page].push(b);
    });

    for (const [pageNum, boxes] of Object.entries(byPage)) {
      const page = pages[parseInt(pageNum) - 1];
      const { height: pageHeight } = page.getSize();

      for (const box of boxes) {
        const pdfWidth =
          typeof box.pdfWidth === "number" && Number.isFinite(box.pdfWidth)
            ? box.pdfWidth
            : box.width;
        const pdfHeight =
          typeof box.pdfHeight === "number" && Number.isFinite(box.pdfHeight)
            ? box.pdfHeight
            : box.height;

        const centerX = box.pdfX + pdfWidth / 2;
        const centerY = pageHeight - box.pdfY - pdfHeight / 2;

        const strokeColor = parseHexColorToRgb(box.strokeColor);
        const fillColor = parseHexColorToRgb(box.fillColor);

        const pdfScaleFactor =
          typeof box.pdfScaleFactor === "number" &&
          Number.isFinite(box.pdfScaleFactor)
            ? box.pdfScaleFactor
            : 1 / 1.5;

        const strokeWidth =
          typeof box.strokeWidth === "number" &&
          Number.isFinite(box.strokeWidth)
            ? box.strokeWidth
            : 2;

        const borderWidth = Math.max(0.25, strokeWidth * pdfScaleFactor);

        page.drawEllipse({
          x: centerX,
          y: centerY,
          xScale: pdfWidth / 2,
          yScale: pdfHeight / 2,
          ...(box.filled ? { color: fillColor } : {}),
          borderColor: strokeColor,
          borderWidth,
        });
      }
    }
  };

  const applyLineBoxesToPdf = async (doc, boxesToApply) => {
    if (!doc || !boxesToApply || boxesToApply.length === 0) return;

    const pages = doc.getPages();

    const byPage = {};
    boxesToApply.forEach((b) => {
      if (!byPage[b.page]) byPage[b.page] = [];
      byPage[b.page].push(b);
    });

    for (const [pageNum, boxes] of Object.entries(byPage)) {
      const page = pages[parseInt(pageNum) - 1];
      const { height: pageHeight } = page.getSize();

      for (const box of boxes) {
        const strokeColor = parseHexColorToRgb(box.strokeColor);

        const pdfScaleFactor =
          typeof box.pdfScaleFactor === "number" &&
          Number.isFinite(box.pdfScaleFactor)
            ? box.pdfScaleFactor
            : 1 / 1.5;

        const strokeWidth =
          typeof box.strokeWidth === "number" &&
          Number.isFinite(box.strokeWidth)
            ? box.strokeWidth
            : 2;

        const thickness = Math.max(0.25, strokeWidth * pdfScaleFactor);

        // New format: endpoints stored directly.
        const hasEndpoints =
          typeof box.pdfX1 === "number" &&
          Number.isFinite(box.pdfX1) &&
          typeof box.pdfY1 === "number" &&
          Number.isFinite(box.pdfY1) &&
          typeof box.pdfX2 === "number" &&
          Number.isFinite(box.pdfX2) &&
          typeof box.pdfY2 === "number" &&
          Number.isFinite(box.pdfY2);

        let start;
        let end;
        if (hasEndpoints) {
          start = { x: box.pdfX1, y: pageHeight - box.pdfY1 };
          end = { x: box.pdfX2, y: pageHeight - box.pdfY2 };
        } else {
          // Back-compat: older format stored as bounding rect + direction flags
          const pdfWidth =
            typeof box.pdfWidth === "number" && Number.isFinite(box.pdfWidth)
              ? box.pdfWidth
              : box.width;
          const pdfHeight =
            typeof box.pdfHeight === "number" && Number.isFinite(box.pdfHeight)
              ? box.pdfHeight
              : box.height;

          const startOnRight = !!box.startOnRight;
          const startOnBottom = !!box.startOnBottom;

          const xLeft = box.pdfX;
          const xRight = box.pdfX + pdfWidth;
          const yTop = pageHeight - box.pdfY;
          const yBottom = pageHeight - box.pdfY - pdfHeight;

          start = {
            x: startOnRight ? xRight : xLeft,
            y: startOnBottom ? yBottom : yTop,
          };

          end = {
            x: startOnRight ? xLeft : xRight,
            y: startOnBottom ? yTop : yBottom,
          };
        }

        page.drawLine({
          start,
          end,
          thickness,
          color: strokeColor,
        });
      }
    }
  };

  // "Apply" keeps text editable + draggable (Canva/PPT style).
  // Text is baked into the PDF only when downloading.
  const handleApplyText = async () => {
    const validBoxes = textBoxes.filter((box) => box.text.trim());
    if (validBoxes.length === 0) {
      alert("Please add some text to the text boxes");
      return;
    }

    setEditMode(null);
  };

  const updateSelectedTextBox = (updates) => {
    if (!selectedTextId) return;

    setTextBoxes((prev) =>
      prev.map((box) => {
        if (box.id !== selectedTextId) return box;

        const next = { ...box, ...updates };

        // Keep pdfFontSize consistent with on-screen fontSize
        if (updates.fontSize !== undefined) {
          const scaleFactor =
            typeof box.pdfScaleFactor === "number" &&
            Number.isFinite(box.pdfScaleFactor)
              ? box.pdfScaleFactor
              : 1 / 1.5;
          next.pdfScaleFactor = scaleFactor;
          next.pdfFontSize = updates.fontSize * scaleFactor;
        }

        return next;
      }),
    );
  };

  // Ctrl+Z undo functionality
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && undoStack.length > 0) {
        e.preventDefault();
        await performUndo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoStack]);

  const saveToUndoStack = async () => {
    if (!pdfDoc) return;
    const pdfBytes = await pdfDoc.save();
    setUndoStack((prev) => [...prev, pdfBytes]);
  };

  const performUndo = async () => {
    if (undoStack.length === 0) return;

    const newStack = [...undoStack];
    const previousState = newStack.pop();
    setUndoStack(newStack);

    // Restore previous PDF state
    const restoredPdf = await PDFDocument.load(previousState);
    setPdfDoc(restoredPdf);

    const blob = new Blob([previousState], { type: "application/pdf" });
    const oldUrl = pdfFile;
    const newUrl = URL.createObjectURL(blob);
    setPdfFile(newUrl);
    if (oldUrl) {
      setTimeout(() => URL.revokeObjectURL(oldUrl), 100);
    }
  };

  const handleAddRectangle = (rect) => {
    if (!rect) return;

    const pdfScaleFactor =
      typeof rect.pdfScaleFactor === "number" &&
      Number.isFinite(rect.pdfScaleFactor)
        ? rect.pdfScaleFactor
        : 1 / 1.5;

    const newRect = {
      id: Date.now(),
      displayX: rect.displayX,
      displayY: rect.displayY,
      width: rect.width,
      height: rect.height,
      pdfX: rect.pdfX,
      pdfY: rect.pdfY,
      pdfWidth: rect.pdfWidth,
      pdfHeight: rect.pdfHeight,
      pdfScaleFactor,
      strokeColor: "#000000",
      fillColor: "#000000",
      filled: false,
      strokeWidth: 2,
      page: currentPage,
    };

    setRectangleBoxes((prev) => [...prev, newRect]);
    setSelectedRectangleId(newRect.id);
    setSelectedTextId(null);
    setSelectedCircleId(null);
    setSelectedLineId(null);
    setEditMode(null);
  };

  const updateSelectedRectangleBox = (updates) => {
    if (!selectedRectangleId) return;
    setRectangleBoxes((prev) =>
      prev.map((b) =>
        b.id === selectedRectangleId ? { ...b, ...updates } : b,
      ),
    );
  };

  const handleRemoveRectangleBox = (id) => {
    setRectangleBoxes((prev) => prev.filter((b) => b.id !== id));
    setSelectedRectangleId((prev) => (prev === id ? null : prev));
  };

  const handleAddCircle = (circle) => {
    if (!circle) return;

    const pdfScaleFactor =
      typeof circle.pdfScaleFactor === "number" &&
      Number.isFinite(circle.pdfScaleFactor)
        ? circle.pdfScaleFactor
        : 1 / 1.5;

    const newCircle = {
      id: Date.now(),
      displayX: circle.displayX,
      displayY: circle.displayY,
      width: circle.width,
      height: circle.height,
      pdfX: circle.pdfX,
      pdfY: circle.pdfY,
      pdfWidth: circle.pdfWidth,
      pdfHeight: circle.pdfHeight,
      pdfScaleFactor,
      strokeColor: "#000000",
      fillColor: "#000000",
      filled: false,
      strokeWidth: 2,
      page: currentPage,
    };

    setCircleBoxes((prev) => [...prev, newCircle]);
    setSelectedCircleId(newCircle.id);
    setSelectedTextId(null);
    setSelectedRectangleId(null);
    setSelectedLineId(null);
    setEditMode(null);
  };

  const updateSelectedCircleBox = (updates) => {
    if (!selectedCircleId) return;
    setCircleBoxes((prev) =>
      prev.map((b) => (b.id === selectedCircleId ? { ...b, ...updates } : b)),
    );
  };

  const handleRemoveCircleBox = (id) => {
    setCircleBoxes((prev) => prev.filter((b) => b.id !== id));
    setSelectedCircleId((prev) => (prev === id ? null : prev));
  };

  const handleAddLine = (line) => {
    if (!line) return;

    const pdfScaleFactor =
      typeof line.pdfScaleFactor === "number" &&
      Number.isFinite(line.pdfScaleFactor)
        ? line.pdfScaleFactor
        : 1 / 1.5;

    const hasEndpoints =
      typeof line.x1 === "number" &&
      Number.isFinite(line.x1) &&
      typeof line.y1 === "number" &&
      Number.isFinite(line.y1) &&
      typeof line.x2 === "number" &&
      Number.isFinite(line.x2) &&
      typeof line.y2 === "number" &&
      Number.isFinite(line.y2);

    // Back-compat: older payloads used a box + direction.
    let x1 = line.x1;
    let y1 = line.y1;
    let x2 = line.x2;
    let y2 = line.y2;
    if (
      !hasEndpoints &&
      typeof line.displayX === "number" &&
      typeof line.displayY === "number" &&
      typeof line.width === "number" &&
      typeof line.height === "number"
    ) {
      const left = line.displayX;
      const top = line.displayY;
      const right = line.displayX + line.width;
      const bottom = line.displayY + line.height;

      const startOnRight = !!line.startOnRight;
      const startOnBottom = !!line.startOnBottom;

      x1 = startOnRight ? right : left;
      y1 = startOnBottom ? bottom : top;
      x2 = startOnRight ? left : right;
      y2 = startOnBottom ? top : bottom;
    }

    const newLine = {
      id: Date.now(),
      x1,
      y1,
      x2,
      y2,
      pdfX1: line.pdfX1,
      pdfY1: line.pdfY1,
      pdfX2: line.pdfX2,
      pdfY2: line.pdfY2,
      pdfScaleFactor,
      strokeColor: "#000000",
      strokeWidth: 2,
      page: currentPage,
    };

    setLineBoxes((prev) => [...prev, newLine]);
    setSelectedLineId(newLine.id);
    setSelectedTextId(null);
    setSelectedRectangleId(null);
    setSelectedCircleId(null);
    setEditMode(null);
  };

  const updateSelectedLineBox = (updates) => {
    if (!selectedLineId) return;
    setLineBoxes((prev) =>
      prev.map((b) => (b.id === selectedLineId ? { ...b, ...updates } : b)),
    );
  };

  const handleRemoveLineBox = (id) => {
    setLineBoxes((prev) => prev.filter((b) => b.id !== id));
    setSelectedLineId((prev) => (prev === id ? null : prev));
  };

  const handleAddHighlight = async (x, y, width, height) => {
    if (!pdfDoc) return;

    await saveToUndoStack();

    pendingGitActionsRef.current.push({
      type: "highlight",
      page: currentPage,
      mode: "draw",
    });

    const pages = pdfDoc.getPages();
    const page = pages[currentPage - 1];
    const { height: pageHeight } = page.getSize();
    const pdfY = pageHeight - y - height;

    page.drawRectangle({
      x: x,
      y: pdfY,
      width: width,
      height: height,
      color: rgb(1, 1, 0),
      opacity: TEXT_HIGHLIGHT_OPACITY,
      blendMode: TEXT_HIGHLIGHT_BLEND_MODE,
    });

    await refreshPDF();
  };

  const refreshPDF = async () => {
    // Save the current PDF document
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });

    // Reload the PDF document to ensure we're working with the latest version
    const arrayBuffer = await blob.arrayBuffer();
    const reloadedPdf = await PDFDocument.load(arrayBuffer);
    setPdfDoc(reloadedPdf);

    // Create new URL and revoke old one to force reload
    const oldUrl = pdfFile;
    const newUrl = URL.createObjectURL(blob);
    setPdfFile(newUrl);
    if (oldUrl) {
      setTimeout(() => URL.revokeObjectURL(oldUrl), 100);
    }
  };

  const buildExportPdfBytes = async () => {
    const validTextBoxes = textBoxes.filter((box) => box.text.trim());
    const hasOverlays =
      validTextBoxes.length > 0 ||
      imageBoxes.length > 0 ||
      textSelections.length > 0 ||
      rectangleBoxes.length > 0 ||
      circleBoxes.length > 0 ||
      lineBoxes.length > 0;

    // Fast path: if there are no pending overlays, just save the existing PDF.
    if (!hasOverlays) {
      return pdfDoc.save();
    }

    // Export: bake overlays into a temporary copy of the PDF.
    const exportBytes = await pdfDoc.save();
    const exportDoc = await PDFDocument.load(exportBytes);

    await applyTextBoxesToPdf(exportDoc, validTextBoxes);
    await applyImageBoxesToPdf(exportDoc, imageBoxes);
    await applyTextSelectionsToPdf(exportDoc, textSelections);
    await applyRectangleBoxesToPdf(exportDoc, rectangleBoxes);
    await applyCircleBoxesToPdf(exportDoc, circleBoxes);
    await applyLineBoxesToPdf(exportDoc, lineBoxes);

    return exportDoc.save();
  };

  const triggerBrowserDownload = (bytes, filename) => {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "edited-document.pdf";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const handleNormalDownload = async () => {
    if (!pdfDoc) return;
    if (downloadLoading) return;

    setDownloadLoading(true);
    try {

      // Normal download should be fast (no rasterize-sanitization) but still update
      // embedded PDF-Git so the Git tree shows your actions after reopening.
      //
      // If this file isn't tied to secure storage (no docId), we can only download locally.
      const pdfBytes = await buildExportPdfBytes();
      const gitActions = buildGitActionsForSave();

      if (!docId) {
        triggerBrowserDownload(pdfBytes, "edited-document.pdf");
        return;
      }

      try {
        // 1) Ask backend to create a new version quickly and embed PDF-Git (no sanitization).
        const fd = new FormData();
        fd.append(
          "pdf",
          new Blob([pdfBytes], { type: "application/pdf" }),
          "edited.pdf",
        );

        if (gitActions.length > 0) {
          fd.append("gitActions", JSON.stringify(gitActions));
        }
        fd.append("gitInitIfMissing", "true");

        const res = await api.post(`/documents/${docId}/update-fast`, fd);
        const newId = res.data?.id;
        if (!newId) throw new Error("Fast update failed");

        // 2) Download the newly-saved bytes so the downloaded file includes updated PDF-Git.
        const downloadRes = await api.get(`/documents/${newId}/download`, {
          responseType: "arraybuffer",
        });
        const downloadBytes = downloadRes.data;
        triggerBrowserDownload(downloadBytes, "edited-document.pdf");

        // 3) Refresh editor state to the saved version so future commits are consistent.
        const blob = new Blob([downloadBytes], { type: "application/pdf" });
        const arrayBuffer = await blob.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);

        setDocId(newId);
        setPdfDoc(pdf);
        const oldUrl = pdfFile;
        const newUrl = URL.createObjectURL(blob);
        setPdfFile(newUrl);
        if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 100);

        setTotalPages(pdf.getPageCount());
        setCurrentPage((prev) => {
          const n = pdf.getPageCount();
          if (!n) return 1;
          const safe = Math.min(Math.max(1, prev || 1), n);
          return safe;
        });

        // Overlays are now baked into the PDF.
        setUndoStack([]);
        setTextBoxes([]);
        setImageBoxes([]);
        setTextSelections([]);
        setRectangleBoxes([]);
        setCircleBoxes([]);
        setLineBoxes([]);
        setEditMode(null);
        setSelectedTextId(null);
        setSelectedRectangleId(null);
        setSelectedCircleId(null);
        setSelectedLineId(null);
        pendingGitActionsRef.current = [];

        try {
          const url = new URL(window.location.href);
          url.searchParams.set("doc", newId);
          window.history.replaceState(null, "", url.toString());
        } catch {
          // ignore
        }

        fetchRecentDocs();
      } catch (e) {
        console.error(e);
        const msg = await getApiErrorMessage(
          e,
          "Fast save failed; downloading locally (Git tree will NOT update).",
        );
        alert(msg);
        triggerBrowserDownload(pdfBytes, "edited-document.pdf");
      }
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleSecureDownload = async () => {
    if (!pdfDoc) return;
    if (downloadLoading) return;

    setDownloadLoading(true);
    try {

      const pdfBytes = await buildExportPdfBytes();
      let downloadBytes = pdfBytes;

    // Persist to secure backend storage by creating a new version, then download the saved bytes.
    // After a successful save, reload that saved version into the editor so the visible PDF,
    // the active docId, and the Git metadata all refer to the same document.
      if (docId) {
        try {
          const fd = new FormData();
          fd.append(
            "pdf",
            new Blob([pdfBytes], { type: "application/pdf" }),
            "edited.pdf",
          );

          const gitActions = buildGitActionsForSave();
          if (gitActions.length > 0) {
            fd.append("gitActions", JSON.stringify(gitActions));
          }

          const res = await api.post(`/documents/${docId}/update`, fd);
          const newId = res.data?.id;
          if (!newId) throw new Error("Update failed");

          const downloadRes = await api.get(`/documents/${newId}/download`, {
            responseType: "arraybuffer",
          });
          downloadBytes = downloadRes.data;

          // Refresh editor state to the newly stored, sanitized PDF version.
          const blob = new Blob([downloadBytes], { type: "application/pdf" });
          const arrayBuffer = await blob.arrayBuffer();
          const pdf = await PDFDocument.load(arrayBuffer);

          setDocId(newId);
          setPdfDoc(pdf);
          const oldUrl = pdfFile;
          const newUrl = URL.createObjectURL(blob);
          setPdfFile(newUrl);
          if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 100);

          setTotalPages(pdf.getPageCount());
          setCurrentPage(1);
          setUndoStack([]);
          setTextBoxes([]);
          setImageBoxes([]);
          setTextSelections([]);
          setRectangleBoxes([]);
          setCircleBoxes([]);
          setLineBoxes([]);
          setEditMode(null);
          setSelectedTextId(null);
          setSelectedRectangleId(null);
          setSelectedCircleId(null);
          setSelectedLineId(null);

          pendingGitActionsRef.current = [];

          // Refresh recent docs after saving
          fetchRecentDocs();
        } catch (e) {
          console.error(e);
          alert(
            e?.response?.data?.error ||
              e.message ||
              "Failed to save securely (download will still proceed)",
          );
        }
      }

      triggerBrowserDownload(downloadBytes, "edited-document.pdf");
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleSecureRedact = async () => {
    try {
      if (!docId || !pdfDoc) {
        alert("No document loaded");
        return;
      }

      // Treat FILLED black rectangles as redactions.
      const candidates = rectangleBoxes.filter((b) => b?.filled === true);
      if (candidates.length === 0) {
        alert("Draw a filled rectangle to redact");
        return;
      }

      const pages = pdfDoc.getPages();
      const redactionsByPage = new Map();

      for (const r of candidates) {
        const pageIndex = (r.page || 1) - 1;
        const page = pages[pageIndex];
        if (!page) continue;
        const { width, height } = page.getSize();

        const x = (r.pdfX || 0) / width;
        const y = (r.pdfY || 0) / height;
        const w = (r.pdfWidth ?? r.width ?? 0) / width;
        const h = (r.pdfHeight ?? r.height ?? 0) / height;

        if (
          !Number.isFinite(x) ||
          !Number.isFinite(y) ||
          !Number.isFinite(w) ||
          !Number.isFinite(h)
        )
          continue;
        const entry = redactionsByPage.get(r.page) || [];
        entry.push({ x, y, width: w, height: h });
        redactionsByPage.set(r.page, entry);
      }

      const redactions = Array.from(redactionsByPage.entries()).map(
        ([page, rects]) => ({ page, rects }),
      );
      const res = await api.post(`/documents/${docId}/redact`, { redactions });
      const newId = res.data?.id;
      if (!newId) throw new Error("Redaction failed");

      const downloadRes = await api.get(`/documents/${newId}/download`, {
        responseType: "arraybuffer",
      });
      const bytes = downloadRes.data;
      const blob = new Blob([bytes], { type: "application/pdf" });
      const arrayBuffer = await blob.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);

      setDocId(newId);
      setPdfDoc(pdf);
      const oldUrl = pdfFile;
      const newUrl = URL.createObjectURL(blob);
      setPdfFile(newUrl);
      if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 100);

      setTotalPages(pdf.getPageCount());
      setCurrentPage(1);
      setUndoStack([]);
      setTextBoxes([]);
      setImageBoxes([]);
      setTextSelections([]);
      setRectangleBoxes([]);
      setCircleBoxes([]);
      setLineBoxes([]);
      setEditMode(null);
      setSelectedTextId(null);
      setSelectedRectangleId(null);
      setSelectedCircleId(null);
      setSelectedLineId(null);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || e.message || "Redaction failed");
    }
  };

  const handleEmbeddedSign = async () => {
    try {
      if (!docId || !pdfDoc) {
        alert("No document loaded");
        return;
      }

      if (embeddedSigning) return;
      setEmbeddedSigning(true);

      const res = await api.post(`/documents/${docId}/sign-embedded`);
      const newId = res.data?.id;
      if (!newId) throw new Error("Embedded signing failed");

      const downloadRes = await api.get(`/documents/${newId}/download`, {
        responseType: "arraybuffer",
      });
      const bytes = downloadRes.data;
      const blob = new Blob([bytes], { type: "application/pdf" });
      const arrayBuffer = await blob.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);

      setDocId(newId);
      setPdfDoc(pdf);
      const oldUrl = pdfFile;
      const newUrl = URL.createObjectURL(blob);
      setPdfFile(newUrl);
      if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 100);

      setTotalPages(pdf.getPageCount());
      setCurrentPage(1);
      setUndoStack([]);
      setTextBoxes([]);
      setImageBoxes([]);
      setTextSelections([]);
      setRectangleBoxes([]);
      setCircleBoxes([]);
      setLineBoxes([]);
      setEditMode(null);
      setSelectedTextId(null);
      setSelectedRectangleId(null);
      setSelectedCircleId(null);
      setSelectedLineId(null);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || e.message || "Embedded signing failed");
    } finally {
      setEmbeddedSigning(false);
    }
  };

  const handleInspectEmbeddedSignature = async () => {
    try {
      if (!docId) {
        alert("No document loaded");
        return;
      }
      const res = await api.get(
        `/documents/${docId}/inspect-embedded-signature`,
      );
      const inspection = res.data?.inspection;
      if (!inspection) throw new Error("Inspection failed");

      if (inspection.looksSigned) {
        alert("Embedded signature detected (ByteRange looks valid)");
        return;
      }

      const markers = [
        inspection.hasSigField ? "SigField" : null,
        inspection.hasByteRange ? "ByteRange" : null,
        inspection.hasContents ? "Contents" : null,
      ].filter(Boolean);

      const issues = Array.isArray(inspection.issues)
        ? inspection.issues
        : [];

      const details = [];
      if (markers.length > 0) details.push(`Markers found: ${markers.join(", ")}`);
      if (inspection.byteRange)
        details.push(`ByteRange: [${inspection.byteRange.join(" ")}]`);
      if (typeof inspection.contentsBytesLength === "number")
        details.push(`Contents bytes: ${inspection.contentsBytesLength}`);
      if (issues.length > 0) details.push(`Issues:\n- ${issues.join("\n- ")}`);

      alert(
        `No valid embedded signature detected${details.length ? `\n\n${details.join("\n")}` : ""}`,
      );
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || e.message || "Inspection failed");
    }
  };

  const handlePageChange = (direction) => {
    const n = Number(totalPages) || 0;
    if (n <= 1) return;

    const dir =
      direction === "next" || direction === 1
        ? 1
        : direction === "prev" || direction === -1
          ? -1
          : 0;
    if (!dir) return;

    setCurrentPage((prev) => {
      const cur = Number(prev) || 1;
      const next = Math.min(Math.max(1, cur + dir), n);
      return next;
    });
  };

  // Keyboard navigation (ArrowLeft/ArrowRight) for page changes.
  useEffect(() => {
    if (!pdfFile) return;

    const onKeyDown = (e) => {
      if (e.defaultPrevented) return;
      if (!pdfFile) return;

      const active = document.activeElement;
      const tag = active?.tagName ? String(active.tagName).toLowerCase() : "";
      const typing =
        active?.isContentEditable ||
        tag === "input" ||
        tag === "textarea" ||
        tag === "select";
      if (typing) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePageChange("prev");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handlePageChange("next");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pdfFile, totalPages]);

  // PDF to Images conversion
  const handlePdfToImages = async () => {
    if (!convertPdfFile) {
      alert("Please select a PDF file first");
      return;
    }

    setConverting(true);

    try {
      const formData = new FormData();
      formData.append("pdf", convertPdfFile);

      const response = await api.post("/pdf-to-images", formData, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `${convertPdfFile.name.replace(".pdf", "")}_images.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert("PDF converted to images successfully!");
      setConvertPdfFile(null);
    } catch (error) {
      console.error("Error converting PDF:", error);
      alert("Failed to convert PDF to images. Please try again.");
    } finally {
      setConverting(false);
    }
  };

  // Images to PDF conversion
  const handleImagesToPdf = async () => {
    if (convertImageFiles.length === 0) {
      alert("Please select at least one image file");
      return;
    }

    setConverting(true);

    try {
      const formData = new FormData();
      convertImageFiles.forEach((file) => {
        formData.append("images", file);
      });

      const response = await api.post("/images-to-pdf", formData, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "converted.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert("Images converted to PDF successfully!");
      setConvertImageFiles([]);
    } catch (error) {
      console.error("Error converting images:", error);
      alert("Failed to convert images to PDF. Please try again.");
    } finally {
      setConverting(false);
    }
  };

  const handleConvertPdfFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type === "application/pdf") {
      setConvertPdfFile(file);
    } else {
      alert("Please select a valid PDF file");
    }
  };

  const handleConvertImageFilesSelect = (event) => {
    const files = Array.from(event.target.files);
    const validImages = files.filter(
      (file) =>
        file.type === "image/jpeg" ||
        file.type === "image/png" ||
        file.type === "image/jpg",
    );

    if (validImages.length === 0) {
      alert("Please select valid image files (JPG, PNG)");
      return;
    }

    setConvertImageFiles(validImages);
  };

  // PDF Merge
  const handleMergePdfFilesSelect = (event) => {
    const files = Array.from(event.target.files || []);
    const validPdfs = files.filter((file) => {
      const name = String(file?.name || "").toLowerCase();
      const type = String(file?.type || "").toLowerCase();
      return type.includes("pdf") || name.endsWith(".pdf");
    });

    if (validPdfs.length < 2) {
      alert("Please select at least 2 PDF files");
      setMergePdfFiles([]);
      return;
    }

    setMergePdfFiles(validPdfs);
  };

  const moveMergePdfFile = (fromIndex, toIndex) => {
    setMergePdfFiles((prev) => {
      if (!Array.isArray(prev)) return prev;
      if (fromIndex < 0 || toIndex < 0) return prev;
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
      if (fromIndex === toIndex) return prev;

      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  };

  const handleMergePdfs = async () => {
    if (mergePdfFiles.length < 2) {
      alert("Please select at least 2 PDF files");
      return;
    }

    setConverting(true);
    try {
      const formData = new FormData();
      mergePdfFiles.forEach((file) => formData.append("pdfs", file));

      const response = await api.post("/merge-pdfs", formData, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "merged.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert("PDFs merged successfully!");
      setMergePdfFiles([]);
    } catch (error) {
      console.error("Error merging PDFs:", error);
      alert(
        await getApiErrorMessage(
          error,
          "Failed to merge PDFs. Please try again.",
        ),
      );
    } finally {
      setConverting(false);
    }
  };

  // PPT to PDF
  const handlePptFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const name = String(file.name || "").toLowerCase();
    if (!name.endsWith(".ppt") && !name.endsWith(".pptx")) {
      alert("Please select a PPT or PPTX file");
      setPptFile(null);
      return;
    }
    setPptFile(file);
  };

  const handlePptToPdf = async () => {
    if (!pptFile) {
      alert("Please select a PPT/PPTX file first");
      return;
    }

    setConverting(true);
    try {
      const formData = new FormData();
      formData.append("ppt", pptFile);

      const response = await api.post("/ppt-to-pdf", formData, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `${pptFile.name.replace(/\.(pptx|ppt)$/i, "")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert("PPT converted to PDF successfully!");
      setPptFile(null);
    } catch (error) {
      console.error("Error converting PPT to PDF:", error);
      alert(
        await getApiErrorMessage(
          error,
          "Failed to convert PPT to PDF. Please try again.",
        ),
      );
    } finally {
      setConverting(false);
    }
  };

  // Lock / Unlock / Watermark
  const handleLockPdfSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const name = String(file.name || "").toLowerCase();
    const type = String(file.type || "").toLowerCase();
    if (!name.endsWith(".pdf") && !type.includes("pdf")) {
      alert("Please select a valid PDF file");
      setLockPdfFile(null);
      return;
    }
    setLockPdfFile(file);
  };

  const handleUnlockPdfSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const name = String(file.name || "").toLowerCase();
    const type = String(file.type || "").toLowerCase();
    if (!name.endsWith(".pdf") && !type.includes("pdf")) {
      alert("Please select a valid PDF file");
      setUnlockPdfFile(null);
      return;
    }
    setUnlockPdfFile(file);
  };

  const handleWatermarkPdfSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const name = String(file.name || "").toLowerCase();
    const type = String(file.type || "").toLowerCase();
    if (!name.endsWith(".pdf") && !type.includes("pdf")) {
      alert("Please select a valid PDF file");
      setWatermarkPdfFile(null);
      return;
    }
    setWatermarkPdfFile(file);
  };

  const handleLockPdf = async () => {
    if (!lockPdfFile) {
      alert("Please select a PDF file first");
      return;
    }
    if (!String(lockPassword || "").trim()) {
      alert("Please enter a password");
      return;
    }

    setConverting(true);
    try {
      const formData = new FormData();
      formData.append("pdf", lockPdfFile);
      formData.append("password", lockPassword);

      const response = await api.post("/lock-pdf", formData, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "locked.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert("PDF locked successfully!");
      setLockPdfFile(null);
      setLockPassword("");
    } catch (error) {
      console.error("Error locking PDF:", error);
      alert(
        await getApiErrorMessage(
          error,
          "Failed to lock PDF. Please try again.",
        ),
      );
    } finally {
      setConverting(false);
    }
  };

  const handleUnlockPdf = async () => {
    if (!unlockPdfFile) {
      alert("Please select a PDF file first");
      return;
    }
    if (!String(unlockPassword || "").trim()) {
      alert("Please enter the password");
      return;
    }

    setConverting(true);
    try {
      const formData = new FormData();
      formData.append("pdf", unlockPdfFile);
      formData.append("password", unlockPassword);

      const response = await api.post("/unlock-pdf", formData, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "unlocked.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert("PDF unlocked successfully!");
      setUnlockPdfFile(null);
      setUnlockPassword("");
    } catch (error) {
      console.error("Error unlocking PDF:", error);
      alert(
        await getApiErrorMessage(
          error,
          "Failed to unlock PDF. Please try again.",
        ),
      );
    } finally {
      setConverting(false);
    }
  };

  const handleWatermarkPdf = async () => {
    if (!watermarkPdfFile) {
      alert("Please select a PDF file first");
      return;
    }
    const text = String(watermarkText || "").trim();
    if (!text) {
      alert("Please enter watermark text");
      return;
    }

    setConverting(true);
    try {
      const formData = new FormData();
      formData.append("pdf", watermarkPdfFile);
      formData.append("text", text);

      const response = await api.post("/watermark-pdf", formData, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "watermarked.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert("Watermark added successfully!");
      setWatermarkPdfFile(null);
      setWatermarkText("CONFIDENTIAL");
    } catch (error) {
      console.error("Error watermarking PDF:", error);
      alert(
        await getApiErrorMessage(
          error,
          "Failed to watermark PDF. Please try again.",
        ),
      );
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="pdf-editor">
      <header
        className="app-header small"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          boxSizing: "border-box",
          borderBottom: "1px solid rgba(140, 148, 145, 0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <h1
            className="header-title"
            style={{
              margin: 0,
              color: "#D2C1B6",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <button
              type="button"
              onClick={goHome}
              title="Go to home"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: 0,
                margin: 0,
                border: "none",
                background: "none",
                color: "inherit",
                font: "inherit",
                cursor: "pointer",
              }}
            >
              <img
                src="/images/iitr_logo.png"
                alt="Logo"
                className="header-logo"
                style={{ width: "22px", height: "22px" }}
              />
              <span>I Hate PDF</span>
            </button>
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          {/* Profile Menu */}
          <div
            ref={profileMenuRef}
            style={{
              position: "relative",
              zIndex: 1000,
            }}
          >
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px",
                borderRadius: "50%",
                backgroundColor: "rgba(210, 193, 182, 0.1)",
                transition: "background-color 0.2s",
              }}
              title="Profile Menu"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#D2C1B6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinelinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </button>

            {showProfileMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: "10px",
                  backgroundColor: "#ffffff",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  minWidth: "200px",
                  padding: "1rem",
                  textAlign: "left",
                  border: "1px solid #8C9491",
                  fontFamily: '"Montserrat", sans-serif',
                }}
              >
                <div
                  style={{
                    borderBottom: "1px solid rgba(140, 148, 145, 0.3)",
                    paddingBottom: "0.8rem",
                    marginBottom: "0.8rem",
                  }}
                >
                  <div
                    style={{
                      color: "#1B3C53",
                      fontWeight: "700",
                      fontSize: "1.1rem",
                      marginBottom: "0.2rem",
                    }}
                  >
                    {currentUser?.name || "User"}
                  </div>
                  <div style={{ color: "#456882", fontSize: "0.85rem" }}>
                    {currentUser?.email || ""}
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  style={{
                    width: "100%",
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    padding: "10px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontFamily: '"Montserrat", sans-serif',
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinelinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {!pdfFile ? (
        loadingPdf || uploadingPdf ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "60vh",
              width: "100%",
            }}
          >
            <div
              style={{
                color: "#1B3C53",
                fontSize: "1.8rem",
                marginBottom: "20px",
                fontFamily: '"Oswald", sans-serif',
              }}
            >
              {loadingPdf ? "Loading document..." : "Uploading & sanitizing..."}
            </div>
            <div
              style={{
                width: "40px",
                height: "40px",
                border: "4px solid rgba(27, 60, 83, 0.2)",
                borderTop: "4px solid #1B3C53",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            ></div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : (
          <div className="upload-section">
            <h2
              style={{
                color: "#1B3C53",
                fontFamily: '"Oswald", sans-serif',
                fontSize: "2.5rem",
                marginBottom: "2rem",
                marginTop: 0,
              }}
            >
              Hi, {currentUser?.name || currentUser?.email || "User"}
            </h2>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              ref={fileInputRef}
              style={{ display: "none" }}
            />
            <button
              className="upload-btn"
              onClick={() => fileInputRef.current.click()}
              disabled={uploadingPdf || loadingPdf}
            >
              {uploadingPdf
                ? "Uploading & sanitizing…"
                : loadingPdf
                  ? "Loading document…"
                  : "Click to select a PDF file to edit"}
            </button>

            <div className="conversion-section">
              <h3>Quick Conversion Tools</h3>

              <div className="conversion-tools-grid">
                <div className="conversion-tool">
                  <h4>PDF to Images</h4>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleConvertPdfFileSelect}
                    ref={convertPdfInputRef}
                    style={{ display: "none" }}
                  />
                  <button
                    className="conversion-btn"
                    onClick={() => convertPdfInputRef.current.click()}
                  >
                    {convertPdfFile
                      ? `Selected: ${convertPdfFile.name}`
                      : "Choose PDF"}
                  </button>
                  {convertPdfFile && (
                    <button
                      className="convert-action-btn"
                      onClick={handlePdfToImages}
                      disabled={converting}
                    >
                      {converting ? "Converting..." : "Convert to Images"}
                    </button>
                  )}
                </div>

                <div className="conversion-tool">
                  <h4>Images to PDF</h4>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    onChange={handleConvertImageFilesSelect}
                    ref={convertImageInputRef}
                    multiple
                    style={{ display: "none" }}
                  />
                  <button
                    className="conversion-btn"
                    onClick={() => convertImageInputRef.current.click()}
                  >
                    {convertImageFiles.length > 0
                      ? `Selected: ${convertImageFiles.length} image${convertImageFiles.length > 1 ? "s" : ""}`
                      : "Choose Images"}
                  </button>
                  {convertImageFiles.length > 0 && (
                    <button
                      className="convert-action-btn"
                      onClick={handleImagesToPdf}
                      disabled={converting}
                    >
                      {converting ? "Converting..." : "Convert to PDF"}
                    </button>
                  )}
                </div>

                <div className="conversion-tool">
                  <h4>Merge PDFs</h4>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleMergePdfFilesSelect}
                    ref={mergePdfInputRef}
                    multiple
                    style={{ display: "none" }}
                  />
                  <button
                    className="conversion-btn"
                    onClick={() => mergePdfInputRef.current.click()}
                  >
                    {mergePdfFiles.length > 0
                      ? `Selected: ${mergePdfFiles.length} PDF${mergePdfFiles.length > 1 ? "s" : ""}`
                      : "Choose PDFs"}
                  </button>

                  {mergePdfFiles.length > 0 && (
                    <div className="merge-order">
                      <div className="merge-order-title">Order</div>
                      <div className="merge-order-list">
                        {mergePdfFiles.map((file, index) => (
                          <div
                            className="merge-order-item"
                            key={`${file.name}-${index}`}
                          >
                            <div className="merge-order-name" title={file.name}>
                              {index + 1}. {file.name}
                            </div>
                            <div className="merge-order-controls">
                              <button
                                type="button"
                                className="merge-order-btn"
                                onClick={() =>
                                  moveMergePdfFile(index, index - 1)
                                }
                                disabled={converting || index === 0}
                                title="Move up"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="merge-order-btn"
                                onClick={() =>
                                  moveMergePdfFile(index, index + 1)
                                }
                                disabled={
                                  converting ||
                                  index === mergePdfFiles.length - 1
                                }
                                title="Move down"
                              >
                                ↓
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {mergePdfFiles.length > 0 && (
                    <button
                      className="convert-action-btn"
                      onClick={handleMergePdfs}
                      disabled={converting}
                    >
                      {converting ? "Merging..." : "Merge PDFs"}
                    </button>
                  )}
                </div>

                <div className="conversion-tool">
                  <h4>PPT to PDF</h4>
                  <input
                    type="file"
                    accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    onChange={handlePptFileSelect}
                    ref={pptInputRef}
                    style={{ display: "none" }}
                  />
                  <button
                    className="conversion-btn"
                    onClick={() => pptInputRef.current.click()}
                  >
                    {pptFile ? `Selected: ${pptFile.name}` : "Choose PPT"}
                  </button>
                  {pptFile && (
                    <button
                      className="convert-action-btn"
                      onClick={handlePptToPdf}
                      disabled={converting}
                    >
                      {converting ? "Converting..." : "Convert to PDF"}
                    </button>
                  )}
                </div>
              </div>

              <div className="conversion-tools-grid-bottom">
                <div className="conversion-tool">
                  <h4>Lock PDF</h4>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleLockPdfSelect}
                    ref={lockPdfInputRef}
                    style={{ display: "none" }}
                  />
                  <button
                    className="conversion-btn"
                    onClick={() => lockPdfInputRef.current.click()}
                  >
                    {lockPdfFile
                      ? `Selected: ${lockPdfFile.name}`
                      : "Choose PDF"}
                  </button>
                  {lockPdfFile && (
                    <>
                      <input
                        className="conversion-input"
                        type="password"
                        placeholder="Password"
                        value={lockPassword}
                        onChange={(e) => setLockPassword(e.target.value)}
                        disabled={converting}
                      />
                      <button
                        className="convert-action-btn"
                        onClick={handleLockPdf}
                        disabled={converting}
                      >
                        {converting ? "Locking..." : "Lock PDF"}
                      </button>
                    </>
                  )}
                </div>

                <div className="conversion-tool">
                  <h4>Unlock PDF</h4>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleUnlockPdfSelect}
                    ref={unlockPdfInputRef}
                    style={{ display: "none" }}
                  />
                  <button
                    className="conversion-btn"
                    onClick={() => unlockPdfInputRef.current.click()}
                  >
                    {unlockPdfFile
                      ? `Selected: ${unlockPdfFile.name}`
                      : "Choose PDF"}
                  </button>
                  {unlockPdfFile && (
                    <>
                      <input
                        className="conversion-input"
                        type="password"
                        placeholder="Password"
                        value={unlockPassword}
                        onChange={(e) => setUnlockPassword(e.target.value)}
                        disabled={converting}
                      />
                      <button
                        className="convert-action-btn"
                        onClick={handleUnlockPdf}
                        disabled={converting}
                      >
                        {converting ? "Unlocking..." : "Unlock PDF"}
                      </button>
                    </>
                  )}
                </div>

                <div className="conversion-tool">
                  <h4>Watermark</h4>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleWatermarkPdfSelect}
                    ref={watermarkPdfInputRef}
                    style={{ display: "none" }}
                  />
                  <button
                    className="conversion-btn"
                    onClick={() => watermarkPdfInputRef.current.click()}
                  >
                    {watermarkPdfFile
                      ? `Selected: ${watermarkPdfFile.name}`
                      : "Choose PDF"}
                  </button>
                  {watermarkPdfFile && (
                    <>
                      <input
                        className="conversion-input"
                        type="text"
                        placeholder="Watermark text"
                        value={watermarkText}
                        onChange={(e) => setWatermarkText(e.target.value)}
                        disabled={converting}
                      />
                      <button
                        className="convert-action-btn"
                        onClick={handleWatermarkPdf}
                        disabled={converting}
                      >
                        {converting ? "Adding..." : "Add Watermark"}
                      </button>
                    </>
                  )}
                </div>

                <div className="conversion-tool">
                  <h4>Sign PDF</h4>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleSignPdfSelect}
                    ref={signPdfInputRef}
                    style={{ display: "none" }}
                  />
                  <button
                    className="conversion-btn"
                    onClick={() => signPdfInputRef.current.click()}
                    disabled={uploadingPdf || loadingPdf}
                  >
                    {uploadingPdf
                      ? "Uploading …"
                      : loadingPdf
                        ? "Loading document…"
                        : "Choose PDF"}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: "24px", width: "100%" }}>
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid #eee",
                    fontWeight: "600",
                    color: "#1B3C53",
                    fontFamily: '"Oswald", sans-serif',
                    fontSize: "1.2rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  Recent PDFs
                  <span
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: "400",
                      color: "#8C9491",
                      fontFamily: '"Montserrat", sans-serif',
                    }}
                  >
                    {recentDocs.length} shown
                  </span>
                </div>

                {recentDocs.length === 0 ? (
                  <div
                    style={{
                      padding: "22px 20px",
                      textAlign: "center",
                      color: "#8C9491",
                      fontSize: "0.95rem",
                    }}
                  >
                    No recent PDFs found
                  </div>
                ) : (
                  <div style={{ border: "1px solid rgba(140, 148, 145, 0.2)" }}>
                    {recentDocs.map((doc) => (
                      <div
                        key={doc._id}
                        onClick={() => {
                          window.location.href = `/?doc=${doc._id}`;
                        }}
                        style={{
                          padding: "14px 20px",
                          borderBottom: "1px solid #f5f5f5",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          transition: "background-color 0.2s",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = "#f8f9fa")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            "transparent")
                        }
                      >
                        <div
                          style={{
                            color: "#1B3C53",
                            fontWeight: "600",
                            fontSize: "1.02rem",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {doc.originalName || "Untitled Document"}
                        </div>
                        <div
                          style={{
                            color: "#8C9491",
                            fontSize: "0.85rem",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span>
                            {new Date(doc.updatedAt).toLocaleDateString()}
                          </span>
                          <span>
                            {new Date(doc.updatedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      ) : (
        <>
          {signingMode ? (
            <div
              className="toolbar"
              style={{
                background: "#1B3C53",
                padding: "1rem 2rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: "#D2C1B6",
              }}
            >
              <div
                style={{ display: "flex", gap: "1rem", alignItems: "center" }}
              >
                <button
                  onClick={() => signPdfInputRef.current.click()}
                  style={{
                    background: "#456882",
                    color: "#D2C1B6",
                    border: "none",
                    padding: "0.5rem 1rem",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Open New PDF
                </button>
                <button
                  onClick={() => setShowNameModal(true)}
                  style={{
                    background: "#456882",
                    color: "#D2C1B6",
                    border: "none",
                    padding: "0.5rem 1rem",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Text
                </button>
                <button
                  onClick={() => setDrawingMode(true)}
                  style={{
                    background: "#456882",
                    color: "#D2C1B6",
                    border: "none",
                    padding: "0.5rem 1rem",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Draw
                </button>
                <button
                  onClick={() => imageInputRef.current.click()}
                  style={{
                    background: "#456882",
                    color: "#D2C1B6",
                    border: "none",
                    padding: "0.5rem 1rem",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Upload
                </button>
              </div>
              <div
                style={{ display: "flex", gap: "1rem", alignItems: "center" }}
              >
                <button
                  onClick={() => handlePageChange("prev")}
                  disabled={currentPage <= 1}
                  style={{
                    background: "#456882",
                    color: "#D2C1B6",
                    border: "none",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  ‹
                </button>
                <span>
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange("next")}
                  disabled={currentPage >= totalPages}
                  style={{
                    background: "#456882",
                    color: "#D2C1B6",
                    border: "none",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  ›
                </button>
                <button
                  onClick={async () => {
                    const bytes = await buildExportPdfBytes();
                    triggerBrowserDownload(
                      bytes,
                      `signed_${signingPdfFile.name}`,
                    );
                  }}
                  style={{
                    background: "#456882",
                    color: "#D2C1B6",
                    border: "none",
                    padding: "0.5rem 1rem",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Download
                </button>
              </div>
            </div>
          ) : (
            <Toolbar
              editMode={editMode}
              setEditMode={setEditMode}
              fontSize={fontSize}
              setFontSize={setFontSize}
              onDownload={handleNormalDownload}
              onSecureDownload={handleSecureDownload}
              downloadLoading={downloadLoading}
              onUndo={performUndo}
              onApplyText={handleApplyText}
              hasTextBoxes={textBoxes.length > 0}
              fontFamily={fontFamily}
              setFontFamily={setFontFamily}
              updateSelectedTextBox={updateSelectedTextBox}
              selectedTextId={selectedTextId}
              onDeselectText={() => setSelectedTextId(null)}
              textBoxes={textBoxes}
              selectedRectangleId={selectedRectangleId}
              rectangleBoxes={rectangleBoxes}
              updateSelectedRectangleBox={updateSelectedRectangleBox}
              onDeselectRectangle={() => setSelectedRectangleId(null)}
              onRemoveRectangleBox={handleRemoveRectangleBox}
              selectedCircleId={selectedCircleId}
              circleBoxes={circleBoxes}
              updateSelectedCircleBox={updateSelectedCircleBox}
              onDeselectCircle={() => setSelectedCircleId(null)}
              onRemoveCircleBox={handleRemoveCircleBox}
              selectedLineId={selectedLineId}
              lineBoxes={lineBoxes}
              updateSelectedLineBox={updateSelectedLineBox}
              onDeselectLine={() => setSelectedLineId(null)}
              onRemoveLineBox={handleRemoveLineBox}
              onApplyImages={handleApplyImages}
              hasImages={imageBoxes.length > 0}
              onImageUpload={() => imageInputRef.current.click()}
              onApplyHighlights={handleApplyHighlights}
              hasTextSelections={textSelections.length > 0}
              canUndo={undoStack.length > 0}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              onUploadNew={() => fileInputRef.current.click()}
              onSecureRedact={handleSecureRedact}
              canSecureRedact={rectangleBoxes.some((b) => b?.filled === true)}
              onEmbeddedSign={handleEmbeddedSign}
              embeddedSignDisabled={embeddedSigning}
              onInspectEmbeddedSignature={handleInspectEmbeddedSignature}
              onLogout={onLogout}
              gitEnabled={gitEnabled}
              gitSignatureOk={gitSignatureOk}
              gitDocId={docId}
              onGitInit={handleGitInit}
              gitInitLoading={gitInitLoading}
              onGitHistory={handleGitHistory}
              onGitVerify={handleGitVerify}
            />
          )}
          <input
            type="file"
            accept="application/pdf"
            onChange={handleSignPdfSelect}
            ref={signPdfInputRef}
            style={{ display: "none" }}
          />
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            ref={fileInputRef}
            style={{ display: "none" }}
          />
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            ref={imageInputRef}
            style={{ display: "none" }}
          />
          <PDFViewer
            pdfFile={pdfFile}
            currentPage={currentPage}
            editMode={editMode}
            fetchOcrForPage={fetchOcrForPage}
            textBoxes={textBoxes.filter((box) => box.page === currentPage)}
            imageBoxes={imageBoxes.filter((box) => box.page === currentPage)}
            textSelections={textSelections.filter(
              (sel) => sel.page === currentPage,
            )}
            rectangleBoxes={rectangleBoxes.filter(
              (b) => b.page === currentPage,
            )}
            selectedTextId={selectedTextId}
            setSelectedTextId={setSelectedTextId}
            selectedRectangleId={selectedRectangleId}
            setSelectedRectangleId={setSelectedRectangleId}
            circleBoxes={circleBoxes.filter((b) => b.page === currentPage)}
            selectedCircleId={selectedCircleId}
            setSelectedCircleId={setSelectedCircleId}
            lineBoxes={lineBoxes.filter((b) => b.page === currentPage)}
            selectedLineId={selectedLineId}
            setSelectedLineId={setSelectedLineId}
            autoFocusTextBoxId={autoFocusTextBoxId}
            onAutoFocusTextBoxDone={() => setAutoFocusTextBoxId(null)}
            onAddTextBox={handleAddTextBox}
            onUpdateTextBox={handleUpdateTextBox}
            onRemoveTextBox={handleRemoveTextBox}
            onUpdateImageBox={handleUpdateImageBox}
            onRemoveImageBox={handleRemoveImageBox}
            onUpdateRectangleBox={(id, updates) => {
              setRectangleBoxes((prev) =>
                prev.map((b) => (b.id === id ? { ...b, ...updates } : b)),
              );
            }}
            onRemoveRectangleBox={handleRemoveRectangleBox}
            onUpdateCircleBox={(id, updates) => {
              setCircleBoxes((prev) =>
                prev.map((b) => (b.id === id ? { ...b, ...updates } : b)),
              );
            }}
            onRemoveCircleBox={handleRemoveCircleBox}
            onUpdateLineBox={(id, updates) => {
              setLineBoxes((prev) =>
                prev.map((b) => (b.id === id ? { ...b, ...updates } : b)),
              );
            }}
            onRemoveLineBox={handleRemoveLineBox}
            onTextSelection={handleTextSelection}
            onRemoveSelection={handleRemoveSelection}
            onAddRectangle={handleAddRectangle}
            onAddCircle={handleAddCircle}
            onAddLine={handleAddLine}
            onAddHighlight={handleAddHighlight}
          />
          {drawingMode && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                background: "rgba(0,0,0,0.8)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 10000,
              }}
            >
              <div
                style={{
                  background: "white",
                  padding: "20px",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <h3>Draw your signature</h3>
                <canvas
                  ref={drawingCanvasRef}
                  width={400}
                  height={200}
                  style={{
                    border: "1px solid #ccc",
                    cursor: "crosshair",
                    background: "white",
                  }}
                  onMouseDown={(e) => {
                    const canvas = drawingCanvasRef.current;
                    const ctx = canvas.getContext("2d");
                    ctx.beginPath();
                    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                    setDrawingCanvas(true);
                  }}
                  onMouseMove={(e) => {
                    if (drawingCanvas) {
                      const canvas = drawingCanvasRef.current;
                      const ctx = canvas.getContext("2d");
                      ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                      ctx.stroke();
                    }
                  }}
                  onMouseUp={() => setDrawingCanvas(false)}
                />
                <div
                  style={{ marginTop: "10px", display: "flex", gap: "10px" }}
                >
                  <button
                    onClick={() => {
                      const canvas = drawingCanvasRef.current;
                      canvas.toBlob((blob) => {
                        const file = new File([blob], "signature.png", {
                          type: "image/png",
                        });
                        handleImageUpload({ target: { files: [file] } });
                        setDrawingMode(false);
                      });
                    }}
                    style={{
                      padding: "10px 20px",
                      background: "#456882",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => {
                      const canvas = drawingCanvasRef.current;
                      const ctx = canvas.getContext("2d");
                      ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }}
                    style={{
                      padding: "10px 20px",
                      background: "#8C9491",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setDrawingMode(false)}
                    style={{
                      padding: "10px 20px",
                      background: "#dc3545",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          {showNameModal && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                background: "rgba(0,0,0,0.55)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 10001,
              }}
            >
              <div
                style={{
                  background: "white",
                  padding: "28px 32px",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  minWidth: "420px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                  gap: "14px",
                }}
              >
                <h3 style={{ margin: 0, color: "#000000", fontSize: "18px" }}>
                  Sign your name
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                  Type your full name below & it will appear in elegant cursive
                  on the PDF.
                </p>
                <input
                  type="text"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && signatureName.trim()) {
                      e.target.blur();
                      document
                        .getElementById("sig-ok-btn")
                        ?.dispatchEvent(
                          new MouseEvent("click", { bubbles: true }),
                        );
                    }
                  }}
                  placeholder="e.g. Jane Smith"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: "2px solid #c5cae9",
                    borderRadius: "6px",
                    fontSize: "16px",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                  autoFocus
                />

                {/* Live cursive preview */}
                <div
                  style={{
                    width: "100%",
                    background: "#f8f9ff",
                    border: "1.5px dashed #9fa8da",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "90px",
                    overflow: "hidden",
                    padding: "6px",
                    boxSizing: "border-box",
                  }}
                >
                  {signatureName.trim() ? (
                    <canvas
                      ref={signaturePreviewRef}
                      width={380}
                      height={90}
                      style={{ display: "block", maxWidth: "100%" }}
                    />
                  ) : (
                    <span
                      style={{
                        color: "#bbb",
                        fontSize: "14px",
                        fontStyle: "italic",
                      }}
                    >
                      Signature preview will appear here…
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "12px", width: "100%" }}>
                  <button
                    id="sig-ok-btn"
                    onClick={async () => {
                      const name = signatureName.trim();
                      if (name) {
                        // Ensure font is loaded before final render
                        try {
                          await document.fonts.load(
                            '700 40px "Dancing Script"',
                          );
                        } catch (_) {
                          /* ignore */
                        }

                        const offscreen = document.createElement("canvas");
                        const ctx = offscreen.getContext("2d");

                        // Measure at high resolution for crisp result
                        const FONT_SIZE = 30;
                        ctx.font = `700 ${FONT_SIZE}px "Dancing Script", cursive`;
                        const measured = ctx.measureText(name);
                        const textW = Math.ceil(measured.width);
                        const PAD_X = 20;
                        const PAD_Y = 1;
                        const textH = Math.ceil(
                          (measured.actualBoundingBoxAscent ?? FONT_SIZE) +
                            (measured.actualBoundingBoxDescent ?? 10),
                        );

                        offscreen.width = textW + PAD_X * 2;
                        offscreen.height = textH + PAD_Y * 2;

                        // Transparent background — no fillRect
                        const ctx2 = offscreen.getContext("2d");
                        ctx2.font = `700 ${FONT_SIZE}px "Dancing Script", cursive`;
                        ctx2.fillStyle = "#000000"; // deep navy ink colour
                        ctx2.fillText(
                          name,
                          PAD_X,
                          PAD_Y +
                            (measured.actualBoundingBoxAscent ?? FONT_SIZE),
                        );

                        // --- UPDATED LOGIC HERE ---
                        offscreen.toBlob((blob) => {
                          const file = new File([blob], "signature.png", {
                            type: "image/png",
                          });

                          // Pipe it through your existing image upload handler.
                          // This automatically sets the correct bounding boxes, converts to base64,
                          // and enables native drag/resize functionality.
                          handleImageUpload({ target: { files: [file] } });
                        }, "image/png");
                        // --------------------------
                      }
                      setShowNameModal(false);
                      setSignatureName("");
                    }}
                    style={{
                      flex: 1,
                      padding: "11px 0",
                      background: "#3949ab",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "15px",
                      opacity: signatureName.trim() ? 1 : 0.5,
                    }}
                    disabled={!signatureName.trim()}
                  >
                    Place Signature
                  </button>
                  <button
                    onClick={() => {
                      setShowNameModal(false);
                      setSignatureName("");
                    }}
                    style={{
                      flex: 1,
                      padding: "11px 0",
                      background: "#f5f5f5",
                      color: "#555",
                      border: "1.5px solid #ddd",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "500",
                      fontSize: "15px",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PDFEditor;
