
import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';
// @ts-ignore
import SpriteText from 'three-spritetext';
import { SymbolDef } from '../../types';
import { domainService } from '../../services/domainService';
import { contextService } from '../../services/contextService';
import { getApiUrl } from '../../services/config';
import { Activity, X, Maximize2 } from 'lucide-react';

interface GraphNode {
    id: string;
    name: string;
    domain: string;
    val: number;
    color: string;
    isCached: boolean;
    x?: number;
    y?: number;
    z?: number;
}

interface GraphLink {
    source: string;
    target: string;
    color?: string;
    width?: number;
}

export const CinematicView: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<any>(null);
    const [eventLog, setEventLog] = useState<{ id: string, type: string, message: string, status: 'pending' | 'processing' | 'done' }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [webglError, setWebglError] = useState<string | null>(null);
    const [stats, setStats] = useState({ nodes: 0, links: 0 });
    const eventQueue = useRef<any[]>([]);
    const graphData = useRef<{ nodes: GraphNode[], links: GraphLink[] }>({ nodes: [], links: [] });

    // WebGL Check
    const isWebglSupported = () => {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    };

    // Initial Load
    useEffect(() => {
        let isMounted = true;
        
        const handleResize = () => {
            if (graphRef.current && containerRef.current) {
                graphRef.current.width(containerRef.current.clientWidth);
                graphRef.current.height(containerRef.current.clientHeight);
            }
        };

        const initGraph = async () => {
            if (!containerRef.current) return;

            if (!isWebglSupported()) {
                setWebglError("WebGL is not supported or is disabled in your browser.");
                setIsLoading(false);
                return;
            }
            
            setIsLoading(true);
            
            // Slight delay to ensure DOM is ready and container has dimensions
            await new Promise(resolve => setTimeout(resolve, 500));
            if (!isMounted) return;

            try {
                // Fetch current cache to mark initial nodes
                const openContexts = await contextService.list();
                const cachedSymbolIds = new Set<string>();
                
                for (const ctx of openContexts) {
                    if (ctx.status === 'open') {
                        const cache = await contextService.getCache(ctx.id);
                        cache.forEach(s => cachedSymbolIds.add(s.id));
                    }
                }

                // Fetch all domains and symbols to populate initial graph
                const domains = await domainService.listDomains();
                const nodeMap = new Map<string, GraphNode>();
                const tempLinks: { source: string, target: string }[] = [];

                for (const domainId of domains) {
                    const symbols = await domainService.getSymbols(domainId);
                    if (symbols && isMounted) {
                        symbols.forEach((s: SymbolDef) => {
                            if (!nodeMap.has(s.id)) {
                                const isCached = cachedSymbolIds.has(s.id);
                                nodeMap.set(s.id, {
                                    id: s.id,
                                    name: s.name,
                                    domain: domainId,
                                    val: isCached ? 5 : 2,
                                    color: getDomainColor(domainId),
                                    isCached: isCached
                                });
                            }

                            if (s.linked_patterns) {
                                s.linked_patterns.forEach(link => {
                                    tempLinks.push({
                                        source: s.id,
                                        target: link.id
                                    });
                                });
                            }
                        });
                    }
                }

                if (!isMounted) return;

                const nodes = Array.from(nodeMap.values());
                const links = tempLinks.filter(l => nodeMap.has(l.target));

                graphData.current = { nodes, links };
                
                // Recalculate sizes once links are established in graphData
                nodes.forEach(node => {
                    node.val = calculateNodeSize(node.id, node.isCached);
                });

                setStats({ nodes: nodes.length, links: links.length });

                // Initialize graph if not already exists
                if (containerRef.current && !graphRef.current) {
                    // Clear container to be safe
                    containerRef.current.innerHTML = '';
                    
                    try {
                        graphRef.current = (ForceGraph3D as any)()(containerRef.current)
                            .graphData(graphData.current)
                            .nodeLabel((node: any) => `
                                <div class="symbol-tooltip">
                                    <div class="tooltip-domain">${node.domain}</div>
                                    <div class="tooltip-id">${node.id}</div>
                                    <div class="tooltip-name">${node.name}</div>
                                </div>
                            `)
                            .nodeThreeObject((node: any) => {
                                const group = new THREE.Group();
                                const size = node.val || 3;
                                
                                // Core Sphere
                                const geometry = new THREE.SphereGeometry(size, 16, 16);
                                const color = new THREE.Color(node.color);
                                const material = new THREE.MeshStandardMaterial({
                                    color: color,
                                    transparent: true,
                                    opacity: node.isCached ? 1 : 0.7,
                                    emissive: color,
                                    emissiveIntensity: node.isCached ? 2 : 0.5,
                                    roughness: 0.2,
                                    metalness: 0.1
                                });
                                const core = new THREE.Mesh(geometry, material);
                                group.add(core);

                                // Gaussian Glow Layer (Only for cached)
                                if (node.isCached) {
                                    const glowGeom = new THREE.SphereGeometry(size * 2.2, 16, 16);
                                    const glowMat = new THREE.MeshBasicMaterial({
                                        color: color,
                                        transparent: true,
                                        opacity: 0.15,
                                        blending: THREE.AdditiveBlending,
                                        side: THREE.BackSide
                                    });
                                    const glow = new THREE.Mesh(glowGeom, glowMat);
                                    glow.name = 'glow';
                                    group.add(glow);
                                }
                                
                                group.userData = { isCached: node.isCached, baseEmissive: node.isCached ? 2 : 0.5 };
                                return group;
                            })
                            .linkWidth((link: any) => {
                                const sNode = typeof link.source === 'object' ? link.source : graphData.current.nodes.find(n => n.id === link.source);
                                const tNode = typeof link.target === 'object' ? link.target : graphData.current.nodes.find(n => n.id === link.target);
                                const baseWidth = link.width || 1;
                                if (sNode && tNode) {
                                    const avgSize = ((sNode.val || 2) + (tNode.val || 2)) / 2;
                                    return baseWidth * (avgSize / 8); 
                                }
                                return baseWidth;
                            })
                            .linkOpacity((link: any) => {
                                const sNode = typeof link.source === 'object' ? link.source : graphData.current.nodes.find(n => n.id === link.source);
                                const tNode = typeof link.target === 'object' ? link.target : graphData.current.nodes.find(n => n.id === link.target);
                                if (sNode && tNode) {
                                    const avgSize = ((sNode.val || 2) + (tNode.val || 2)) / 2;
                                    return Math.min(0.5, 0.1 + (avgSize / 60));
                                }
                                return 0.15;
                            })
                            .linkColor((link: any) => {
                                const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
                                const node = graphData.current.nodes.find(n => n.id === sourceId);
                                return node ? node.color : '#444444';
                            })
                            .backgroundColor('#020202')
                            .showNavInfo(false);

                        window.addEventListener('resize', handleResize);

                        // Animation loop for gentle pulsing of cached nodes
                        const animate = () => {
                            if (!graphRef.current) return;
                            
                            const time = Date.now() * 0.002;
                            const pulse = (Math.sin(time) + 1) * 0.5; // 0 to 1
                            
                            graphRef.current.scene().traverse((obj: any) => {
                                if (obj.type === 'Group' && obj.userData && obj.userData.isCached) {
                                    const core = obj.children[0];
                                    if (core && core.material) {
                                        core.material.emissiveIntensity = obj.userData.baseEmissive + (pulse * 1.5);
                                        const scale = 1 + (pulse * 0.1);
                                        obj.scale.set(scale, scale, scale);
                                    }
                                }
                            });
                            
                            requestAnimationFrame(animate);
                        };
                        animate();

                        // Add some global light to make materials visible
                        const scene = graphRef.current.scene();
                        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
                        scene.add(ambientLight);

                    } catch (e: any) {
                        console.error("Three.js/WebGL error during init", e);
                        setWebglError(`Failed to initialize 3D Engine: ${e.message}`);
                    }
                }
            } catch (err: any) {
                console.error("Failed to initialize cinematic graph", err);
                setWebglError(`Failed to load symbolic store: ${err.message}`);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        initGraph();

        // Subscribe to SSE with auth token
        const token = localStorage.getItem('signalzero_auth_token') || '';
        const eventSource = new EventSource(`${getApiUrl()}/events/subscribe?token=${encodeURIComponent(token)}`);
        
        eventSource.onmessage = (event) => {
            try {
                const kernelEvent = JSON.parse(event.data);
                if (kernelEvent.type === 'CONNECTED') return;
                
                eventQueue.current.push(kernelEvent);
            } catch (e) {
                console.error("Failed to parse kernel event", e);
            }
        };

        return () => {
            isMounted = false;
            window.removeEventListener('resize', handleResize);
            eventSource.close();
            if (graphRef.current) {
                // Proper cleanup for 3d-force-graph/three.js
                if (graphRef.current._destructor) graphRef.current._destructor();
                graphRef.current = null;
            }
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, []);

    // Event Processor Loop
    useEffect(() => {
        const processNextEvent = async () => {
            if (eventQueue.current.length === 0) {
                setTimeout(processNextEvent, 500);
                return;
            }

            const event = eventQueue.current.shift();
            await handleVisualEvent(event);

            // Dynamic delay based on queue depth
            const baseDelay = 1000;
            const delay = Math.max(100, baseDelay / Math.log2(eventQueue.current.length + 2));
            setTimeout(processNextEvent, delay);
        };

        processNextEvent();
    }, []);

    const isNodeVisible = (node: any) => {
        if (!graphRef.current) return false;
        const camera = graphRef.current.camera();
        
        const frustum = new THREE.Frustum();
        const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(matrix);
        
        const pos = new THREE.Vector3(node.x || 0, node.y || 0, node.z || 0);
        return frustum.containsPoint(pos);
    };

    const createParticleBurst = (x: number, y: number, z: number, color: string, intensity: 'normal' | 'high' = 'normal') => {
        if (!graphRef.current) return;
        const scene = graphRef.current.scene();
        
        const count = intensity === 'high' ? 400 : 50; 
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities: THREE.Vector3[] = [];
        
        for (let i = 0; i < count; i++) {
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            
            const speed = intensity === 'high' ? 5 : 2;
            velocities.push(new THREE.Vector3(
                (Math.random() - 0.5) * speed,
                (Math.random() - 0.5) * speed,
                (Math.random() - 0.5) * speed
            ));
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            color: new THREE.Color(color),
            size: intensity === 'high' ? 2 : 1.5,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending
        });
        
        const points = new THREE.Points(geometry, material);
        scene.add(points);
        
        // Animation
        let opacity = 1;
        const animateBurst = () => {
            if (opacity <= 0) {
                scene.remove(points);
                geometry.dispose();
                material.dispose();
                return;
            }
            
            const pos = geometry.attributes.position.array as Float32Array;
            for (let i = 0; i < count; i++) {
                pos[i * 3] += velocities[i].x;
                pos[i * 3 + 1] += velocities[i].y;
                pos[i * 3 + 2] += velocities[i].z;
            }
            geometry.attributes.position.needsUpdate = true;
            
            opacity -= 0.015;
            material.opacity = opacity;
            requestAnimationFrame(animateBurst);
        };
        animateBurst();
    };

    const calculateNodeSize = (nodeId: string, isCached: boolean) => {
        const linkCount = graphData.current.links.filter(l => {
            const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
            const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
            return s === nodeId || t === nodeId;
        }).length;
        
        const baseSize = isCached ? 6 : 3;
        // Increase size log-scaled by connections
        return baseSize + (Math.log10(linkCount + 1) * 8);
    };

    const pulseNode = async (nodeId: string, color?: string) => {
        const node = graphData.current.nodes.find(n => n.id === nodeId);
        if (node && graphRef.current) {
            const scene = graphRef.current.scene();
            
            // Only move camera if node is not visible
            if (!isNodeVisible(node)) {
                const distance = 80;
                const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);

                graphRef.current.cameraPosition(
                    { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio }, 
                    node, 
                    2000
                );
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            // Create Transient Label
            const label = new (SpriteText as any)(node.id);
            label.color = '#ffffff';
            label.textHeight = 4;
            label.position.set(node.x || 0, (node.y || 0) + 10, node.z || 0);
            scene.add(label);

            // Create Burst
            createParticleBurst(node.x || 0, node.y || 0, node.z || 0, node.color);

            const originalVal = node.val;
            node.val = originalVal * 4; // Pronounced pulse
            graphRef.current.graphData(graphData.current);
            
            await new Promise(resolve => setTimeout(resolve, 1500)); // Pulse duration
            
            // Fade out label
            let labelOpacity = 1;
            const fadeLabel = () => {
                if (labelOpacity <= 0) {
                    scene.remove(label);
                    return;
                }
                labelOpacity -= 0.05;
                label.material.opacity = labelOpacity;
                requestAnimationFrame(fadeLabel);
            };
            fadeLabel();

            node.val = originalVal;
            graphRef.current.graphData(graphData.current);
            await new Promise(resolve => setTimeout(resolve, 500)); // Breathe
        }
    };

    const syncNodeObject = (nodeId: string, isCached: boolean) => {
        if (!graphRef.current) return;
        graphRef.current.scene().traverse((obj: any) => {
            if (obj.type === 'Group' && obj.__data && obj.__data.id === nodeId) {
                obj.userData.isCached = isCached;
                obj.userData.baseEmissive = isCached ? 2 : 0.5;
                if (!isCached) {
                    obj.scale.set(1, 1, 1); // Reset scale
                    const core = obj.children[0];
                    if (core && core.material) core.material.emissiveIntensity = 0.5;
                    
                    // Remove glow if exists
                    const glow = obj.children.find((c: any) => c.name === 'glow');
                    if (glow) obj.remove(glow);
                } else {
                    // Add glow if missing
                    const hasGlow = obj.children.some((c: any) => c.name === 'glow');
                    if (!hasGlow) {
                        const core = obj.children[0];
                        if (core) {
                            const size = core.geometry.parameters.radius;
                            const glowGeom = new THREE.SphereGeometry(size * 2.2, 16, 16);
                            const glowMat = new THREE.MeshBasicMaterial({
                                color: core.material.color,
                                transparent: true,
                                opacity: 0.15,
                                blending: THREE.AdditiveBlending,
                                side: THREE.BackSide
                            });
                            const glow = new THREE.Mesh(glowGeom, glowMat);
                            glow.name = 'glow';
                            obj.add(glow);
                        }
                    }
                }
            }
        });
    };

    const triggerSupernova = async (nodeIds: string[]) => {
        if (!graphRef.current) return;
        
        // 1. Zoom out only if most nodes are missing from view
        const visibleCount = graphData.current.nodes.filter(n => nodeIds.includes(n.id) && isNodeVisible(n)).length;
        if (visibleCount < nodeIds.length * 0.5) {
            graphRef.current.cameraPosition(
                { x: 0, y: 0, z: 800 }, // Global view
                { x: 0, y: 0, z: 0 },   // Center
                2000
            );
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        // 2. Supernova Flare
        const affectedNodes = graphData.current.nodes.filter(n => nodeIds.includes(n.id));
        
        // All nodes flare together with MASSIVE particles
        affectedNodes.forEach(node => {
            node.val = 20; // Massive flare
            createParticleBurst(node.x || 0, node.y || 0, node.z || 0, '#ffffff', 'high'); 
            createParticleBurst(node.x || 0, node.y || 0, node.z || 0, node.color, 'normal');
            syncNodeObject(node.id, true);
        });
        graphRef.current.graphData(graphData.current);

        await new Promise(resolve => setTimeout(resolve, 2000));

        // 3. Subside to cached state
        affectedNodes.forEach(node => {
            node.val = 6; 
        });
        graphRef.current.graphData(graphData.current);
    };

    const ensureNodeExists = async (symbolId: string) => {
        if (graphData.current.nodes.find(n => n.id === symbolId)) return true;
        
        try {
            const s = await domainService.findById(symbolId);
            if (s) {
                graphData.current.nodes.push({
                    id: s.id,
                    name: s.name,
                    domain: s.symbol_domain,
                    val: 2,
                    color: getDomainColor(s.symbol_domain),
                    isCached: false
                });
                graphRef.current.graphData(graphData.current);
                return true;
            }
        } catch (e) {
            console.warn(`Could not find symbol ${symbolId} to create link`, e);
        }
        return false;
    };

    const handleVisualEvent = async (event: any) => {
        const { type, data } = event;
        const eventId = Math.random().toString(36).substring(7);
        let logMsg = "";

        switch (type) {
            case 'SYMBOL_ADD': logMsg = `Added Symbol: ${data.symbolId}`; break;
            case 'CACHE_LOAD': logMsg = `Cache Load: ${data.symbolIds?.length || 1} symbols`; break;
            case 'CACHE_EVICT': logMsg = `Cache Evict: ${data.symbolIds?.length || 0} symbols`; break;
            case 'LINK_CREATE': logMsg = `Linked: ${data.sourceId} -> ${data.targetId}`; break;
            case 'TENTATIVE_LINK_CREATE': logMsg = `Tentative Link: ${data.sourceId} <-> ${data.targetId}`; break;
            case 'LINK_DELETE': logMsg = `Link Deleted: ${data.sourceId} -> ${data.targetId}`; break;
            case 'TRACE_GENERATE': logMsg = `Trace: ${data.trace.id}`; break;
        }

        if (logMsg) {
            const newEntry = { id: eventId, type, message: logMsg, status: 'processing' as const };
            setEventLog(prev => [newEntry, ...prev].slice(0, 15));
        }

        switch (type) {
            case 'SYMBOL_ADD': {
                const s = data.symbol;
                let isNew = false;
                if (!graphData.current.nodes.find(n => n.id === s.id)) {
                    graphData.current.nodes.push({
                        id: s.id,
                        name: s.name,
                        domain: data.domainId,
                        val: 2, // Base size before link calculation
                        color: getDomainColor(data.domainId),
                        isCached: false
                    });
                    isNew = true;
                }

                // Process initial links to ensure targets exist
                if (s.linked_patterns) {
                    for (const link of s.linked_patterns) {
                        const targetId = link.id;
                        await ensureNodeExists(targetId);
                        
                        const linkExists = graphData.current.links.some(l => {
                            const src = typeof l.source === 'string' ? l.source : (l.source as any).id;
                            const tgt = typeof l.target === 'string' ? l.target : (l.target as any).id;
                            return (src === s.id && tgt === targetId) || (src === targetId && tgt === s.id);
                        });

                        if (!linkExists) {
                            graphData.current.links.push({
                                source: s.id,
                                target: targetId
                            });
                        }
                    }
                }

                // Update size
                const node = graphData.current.nodes.find(n => n.id === s.id);
                if (node) node.val = calculateNodeSize(s.id, node.isCached);

                graphRef.current.graphData(graphData.current);
                
                if (isNew) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await pulseNode(s.id);
                }
                logMsg = `Added Symbol: ${s.id}`;
                break;
            }
            case 'CACHE_LOAD': {
                const ids = data.symbolIds || [data.symbolId];
                logMsg = `Cache Load: ${ids.length} symbols`;
                
                const validIds: string[] = [];
                for (const id of ids) {
                    const exists = await ensureNodeExists(id);
                    if (exists) {
                        const node = graphData.current.nodes.find(n => n.id === id);
                        if (node) {
                            node.isCached = true;
                            validIds.push(id);
                        }
                    }
                }

                if (validIds.length > 0) {
                    await triggerSupernova(validIds);
                }
                break;
            }
            case 'CACHE_EVICT': {
                const { symbolIds } = data;
                
                // Cinematic pause before eviction
                await new Promise(resolve => setTimeout(resolve, 500));

                symbolIds.forEach((id: string) => {
                    const node = graphData.current.nodes.find(n => n.id === id);
                    if (node) {
                        node.isCached = false;
                        node.val = calculateNodeSize(id, false);
                        syncNodeObject(id, false);
                    }
                });
                graphRef.current.graphData(graphData.current);
                break;
            }
            case 'LINK_CREATE': {
                const { sourceId, targetId } = data;
                
                const sExists = await ensureNodeExists(sourceId);
                const tExists = await ensureNodeExists(targetId);
                
                if (sExists && tExists) {
                    await pulseNode(sourceId);
                    
                    graphData.current.links.push({
                        source: sourceId,
                        target: targetId,
                        color: '#00f0ff',
                        width: 6
                    });
                    
                    // Recalculate sizes
                    const sNode = graphData.current.nodes.find(n => n.id === sourceId);
                    const tNode = graphData.current.nodes.find(n => n.id === targetId);
                    if (sNode) sNode.val = calculateNodeSize(sourceId, sNode.isCached);
                    if (tNode) tNode.val = calculateNodeSize(targetId, tNode.isCached);

                    graphRef.current.graphData(graphData.current);
                    
                    await pulseNode(targetId);

                    setTimeout(() => {
                        const link = graphData.current.links.find(l => 
                            (typeof l.source === 'string' ? l.source : (l.source as any).id) === sourceId && 
                            (typeof l.target === 'string' ? l.target : (l.target as any).id) === targetId
                        );
                        if (link) {
                            delete link.color;
                            delete link.width;
                            graphRef.current.graphData(graphData.current);
                        }
                    }, 4000);
                }
                break;
            }
            case 'LINK_DELETE': {
                const { sourceId, targetId } = data;
                graphData.current.links = graphData.current.links.filter(l => {
                    const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
                    const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
                    return !(s === sourceId && t === targetId);
                });
                
                // Recalculate sizes
                const sNode = graphData.current.nodes.find(n => n.id === sourceId);
                const tNode = graphData.current.nodes.find(n => n.id === targetId);
                if (sNode) sNode.val = calculateNodeSize(sourceId, sNode.isCached);
                if (tNode) tNode.val = calculateNodeSize(targetId, tNode.isCached);

                graphRef.current.graphData(graphData.current);
                break;
            }
            case 'TENTATIVE_LINK_CREATE': {
                const { sourceId, targetId, count } = data;
                
                const sExists = await ensureNodeExists(sourceId);
                const tExists = await ensureNodeExists(targetId);

                if (sExists && tExists) {
                    const existing = graphData.current.links.find(l => {
                        const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
                        const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
                        return (s === sourceId && t === targetId) || (s === targetId && t === sourceId);
                    });

                    if (existing) {
                        const originalColor = existing.color;
                        const originalWidth = existing.width;
                        existing.color = '#ffff00'; 
                        existing.width = 3;
                        graphRef.current.graphData(graphData.current);
                        
                        setTimeout(() => {
                            existing.color = originalColor;
                            existing.width = originalWidth;
                            graphRef.current.graphData(graphData.current);
                        }, 500);
                    } else {
                        graphData.current.links.push({
                            source: sourceId,
                            target: targetId,
                            color: 'rgba(255, 255, 255, 0.1)',
                            width: 0.5
                        });
                        
                        // Recalculate sizes
                        const sNode = graphData.current.nodes.find(n => n.id === sourceId);
                        const tNode = graphData.current.nodes.find(n => n.id === targetId);
                        if (sNode) sNode.val = calculateNodeSize(sourceId, sNode.isCached);
                        if (tNode) tNode.val = calculateNodeSize(targetId, tNode.isCached);

                        graphRef.current.graphData(graphData.current);
                    }
                }
                break;
            }
            case 'TENTATIVE_LINK_DELETE': {
                const { sourceId, targetId } = data;
                graphData.current.links = graphData.current.links.filter(l => {
                    const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
                    const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
                    return !((s === sourceId && t === targetId) || (s === targetId && t === sourceId));
                });
                
                // Recalculate sizes
                const sNode = graphData.current.nodes.find(n => n.id === sourceId);
                const tNode = graphData.current.nodes.find(n => n.id === targetId);
                if (sNode) sNode.val = calculateNodeSize(sourceId, sNode.isCached);
                if (tNode) tNode.val = calculateNodeSize(targetId, tNode.isCached);

                graphRef.current.graphData(graphData.current);
                break;
            }
            case 'TRACE_GENERATE': {
                const { trace } = data;
                if (trace.activation_path) {
                    for (const step of trace.activation_path) {
                        if (step.symbol_id) {
                            await pulseNode(step.symbol_id);
                        }
                    }
                }
                break;
            }
        }

        // Wait 2 seconds while highlighted before fading
        await new Promise(resolve => setTimeout(resolve, 2000));
        setEventLog(prev => prev.map(entry => entry.id === eventId ? { ...entry, status: 'done' } : entry));
    };

    const getDomainColor = (domain: string) => {
        const hash = domain.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
        return `hsl(${hash % 360}, 70%, 60%)`;
    };

    return (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col font-mono text-white overflow-hidden">
            {/* Header */}
            <div className="h-12 border-b border-white/10 flex items-center justify-between px-6 bg-black/80 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <Activity className={`${isLoading ? 'text-amber-500' : 'text-emerald-500'} animate-pulse`} size={20} />
                    <span className="font-bold tracking-tighter text-sm uppercase">
                        SignalZero Kernel Monitor 
                        <span className="ml-4 text-gray-500 font-normal normal-case">
                            {isLoading ? 'Synchronizing...' : `${stats.nodes} Symbols • ${stats.links} Links`}
                        </span>
                    </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-gray-500">
                    <span>Events in Queue: {eventQueue.current.length}</span>
                    <button onClick={() => window.close()} className="p-1 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Graph Area */}
            <div className="flex-1 w-full relative">
                <div ref={containerRef} className="absolute inset-0" />

                {isLoading && !webglError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 pointer-events-none">
                        <div className="flex flex-col items-center gap-4">
                            <Activity className="text-emerald-500 animate-spin" size={48} />
                            <div className="text-emerald-500 text-sm animate-pulse">Initializing Symbolic Map...</div>
                        </div>
                    </div>
                )}

                {webglError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 p-8 text-center">
                        <div className="max-w-md flex flex-col items-center gap-6">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                                <X className="text-red-500" size={32} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-white">Hardware Acceleration Required</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    {webglError}
                                </p>
                            </div>
                            <button 
                                onClick={() => window.location.reload()}
                                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors border border-white/10"
                            >
                                Retry Initialization
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Event Ticker */}
            <div className="h-32 border-t border-white/10 bg-black/90 p-4 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-emerald-500/30"></div>
                <div className="space-y-1">
                    {eventLog.map((log, i) => (
                        <div key={log.id} className={`text-[10px] flex gap-6 transition-opacity duration-1000 ${log.status === 'done' ? 'opacity-20' : 'opacity-100'} ${log.status === 'processing' ? 'text-emerald-400 font-bold' : 'text-gray-500'}`}>
                            <span className="w-32 shrink-0 tracking-widest">[{log.type}]</span>
                            <span className="truncate">{log.message}</span>
                        </div>
                    ))}
                </div>
                {eventLog.length === 0 && (
                    <div className="h-full flex items-center justify-center text-gray-700 italic text-xs">
                        Awaiting Kernel Operations...
                    </div>
                )}
            </div>

            <style>{`
                .symbol-tooltip {
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 8px;
                    padding: 8px 12px;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                    color: white;
                    max-width: 300px;
                    pointer-events: none;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
                }
                .tooltip-domain {
                    font-size: 9px;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.5);
                    margin-bottom: 2px;
                    letter-spacing: 0.05em;
                }
                .tooltip-id {
                    font-size: 12px;
                    font-weight: bold;
                    color: #00f0ff;
                    margin-bottom: 4px;
                }
                .tooltip-name {
                    font-size: 11px;
                    line-height: 1.4;
                    color: rgba(255, 255, 255, 0.9);
                }
            `}</style>
        </div>
    );
};
