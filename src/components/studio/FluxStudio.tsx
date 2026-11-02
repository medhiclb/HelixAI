import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { StudioVideo } from "@/lib/studioVideo";

/** Les liaisons suivent les cartes et représentent exclusivement les textes sélectionnés. */
export function FluxStudio({studio,children}:{studio:StudioVideo;children:ReactNode}) {
  const racine=useRef<HTMLDivElement>(null);
  const [traits,setTraits]=useState<{id:string;d:string}[]>([]);
  const [dimensions,setDimensions]=useState({largeur:1,hauteur:1});
  useLayoutEffect(()=>{
    const r=racine.current;if(!r)return;
    let frame=0;
    const mesurer=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      const base=r.getBoundingClientRect();const echelle=base.width/r.offsetWidth || 1;
      const noeuds=new Map(Array.from(r.querySelectorAll<HTMLElement>('[data-noeud]')).map(n=>[n.dataset.noeud!,n.getBoundingClientRect()]));
      const liens:{id:string;d:string}[]=[];
      for(const scene of studio.scenes){const arrivee=noeuds.get(scene.id);if(!arrivee)continue;
        for(const id of scene.sources??['brief']){const depart=noeuds.get(id);if(!depart)continue;
          const x1=(depart.right-base.left)/echelle,y1=(depart.top-base.top)/echelle+36;
          const x2=(arrivee.left-base.left)/echelle,y2=(arrivee.top-base.top)/echelle+36;
          liens.push({id:`${id}-${scene.id}`,d:`M${x1},${y1} C${x1+24},${y1} ${x2-24},${y2} ${x2},${y2}`});
        }
      }setTraits(liens);setDimensions({largeur:r.scrollWidth,hauteur:r.scrollHeight});
    })};
    const observateur=new ResizeObserver(mesurer);observateur.observe(r);r.querySelectorAll('[data-noeud]').forEach(n=>observateur.observe(n));mesurer();
    return()=>{cancelAnimationFrame(frame);observateur.disconnect()};
  },[studio]);
  return <div ref={racine} className="relative"><svg aria-hidden="true" width={dimensions.largeur} height={dimensions.hauteur} className="pointer-events-none absolute inset-0 overflow-visible text-primary/40">{traits.map(l=><path key={l.id} d={l.d} fill="none" stroke="currentColor" strokeWidth={2}/>)}</svg><div className="relative">{children}</div></div>;
}
