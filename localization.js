let locale = 'en';
let dictionary = {};
let phrases = /$^/g;
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function configureTranslations(messages) {
  dictionary = messages.translations || {};
  phrases = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${Object.keys(dictionary).sort((a,b)=>b.length-a.length).map(escape).join('|')})(?![\\p{L}\\p{N}_])`, 'gu');
}
export function setLocale(value) { locale = value === 'fr' ? 'fr' : 'en'; }
export function getLocale() { return locale; }

// The simulation and saved journal retain their original messages. Translate only
// their presentation, so changing language cannot alter a fight or its RNG.
const templates = [
  [/^Resume expedition · depth (\d+)$/,(_,n)=>`Reprendre · profondeur ${n}`],
  [/One attempt\. Capture chance: (\d+)%\./g,(_,n)=>`Une tentative. Chance de capture : ${n} %.`],
  [/Best depth (\d+)\. Your permanent progress is ready for the next adventure\./g,(_,n)=>`Meilleure profondeur : ${n}. Votre progression permanente vous attend pour la prochaine aventure.`],
  [/Equipment found: (.+) · tier (\d+)\./g,(_,name,n)=>`Équipement trouvé : ${translate(name)} · palier ${n}.`],
  [/Pokémon captured: (.+)\./g,(_,name)=>`Pokémon capturé : ${translate(name)}.`],
  [/^(Woodland|Silvermist|Sanctuary) (Battle|Elite|Spring|Supplies|Merchant|Shrine)(\.)?$/, (_,area,kind,dot)=>`${translate(kind)} — ${translate(area)}${dot||''}`],
  [/^(\d+) boon ranks$/, (_,n)=>`${n} rang${Number(n)===1?'':'s'} de bonus`],
  [/^Seen (\d+) · Defeated (\d+)$/, (_,seen,won)=>`Vu : ${seen} · Vaincu : ${won}`],
  [/^(\s*)(\d+) to (\d+)(\s*)$/, (_,before,a,b,after)=>`${before}${a} à ${b}${after}`],
  [/^(.+) uses (.+)!$/, (_,name,move)=>`${translate(name)} utilise ${translate(move)} !`],
  [/^(.+) is evolving…$/, (_,name)=>`${translate(name)} évolue…`],
  [/^(.+) joins your journey!$/, (_,name)=>`${translate(name)} rejoint l’aventure !`],
  [/^(.+) challenges you!$/, (_,name)=>`${translate(name)} vous défie !`],
  [/^(.+) evolved!$/, (_,name)=>`${translate(name)} a évolué !`],
  [/^(.+) learned!$/, (_,name)=>`Capacité apprise : ${translate(name)} !`],
  [/^(.+) acquired\.$/, (_,name)=>`Bonus obtenu : ${translate(name)}.`],
  [/^(.+) awakened!$/, (_,name)=>`Relique éveillée : ${translate(name)} !`],
  [/^(.+) chosen\.$/, (_,name)=>`Étape choisie : ${translate(name)}.`],
  [/^Reached level (\d+)!$/, (_,n)=>`Niveau ${n} atteint !`],
  [/^Resume expedition · stage (\d+)$/, (_,n)=>`Reprendre · étape ${n}`],
  [/^Reforge boons · (\d+) gold · (\d+) left$/, (_,cost,left)=>`Reforger · ${cost} or · ${left} restantes`],
  [/Maximum HP \+([\d.]+) to ([\d.]+)\. HP after choice: ([\d./]+)\./g, (_,gain,max,hp)=>`PV maximums +${gain}, soit ${max}. PV après choix : ${hp}.`],
  [/HP after choice: ([\d./]+)\./g, (_,hp)=>`PV après choix : ${hp}.`],
  [/Restore (\d+) HP and (\d+) PP\./g, (_,hp,pp)=>`Restaurez ${hp} PV et ${pp} PP.`],
  [/Restore (\d+) HP\./g, (_,hp)=>`Restaurez ${hp} PV.`],
  [/Level \+1, maximum HP \+(\d+)\./g, (_,hp)=>`Niveau +1, PV maximums +${hp}.`],
  [/Evolves into ([^.]+)\./g, (_,name)=>`Évolue en ${translate(name)}.`],
  [/Learn ([^.]+)\./g, (_,moves)=>`Apprend ${translate(moves)}.`],
  [/Awakens ([^!]+)!/g, (_,names)=>`Éveille ${translate(names)} !`],
  [/Pay (\d+) HP when choosing a compatible boon\. Click here to cancel\./g, (_,hp)=>`Payez ${hp} PV au choix d’un bonus compatible. Cliquez ici pour annuler.`],
  [/Offer (\d+) HP for two ranks of a compatible boon\./g, (_,hp)=>`Offrez ${hp} PV pour deux rangs d’un bonus compatible.`],
  [/More than (\d+) HP required\./g, (_,hp)=>`Il faut plus de ${hp} PV.`],
  [/Need (\d+) (?:more )?gold\./g, (_,gold)=>`Il manque ${gold} pièces d’or.`],
  [/(\d+) gold left\./g, (_,gold)=>`Il restera ${gold} pièces d’or.`],
  [/Maximum (.+?) rank reached\./g, (_,name)=>`Rang maximum de ${translate(name)} atteint.`],
  [/Threat (\d+) cleared\./g, (_,n)=>`Menace ${n} vaincue.`],
  [/Threat (\d+) is available\./g, (_,n)=>`La Menace ${n} est disponible.`],
  [/Enemy HP \+(\d+)%\. Enemy damage \+(\d+)%\. Battle and ending gold \+(\d+)%\./g, (_,hp,dmg,gold)=>`PV ennemis +${hp} %. Dégâts ennemis +${dmg} %. Or des combats et de fin +${gold} %.`],
  [/Locked\. Clear (the normal trail|Threat \d+) first\./g, (_,challenge)=>`Verrouillé. Terminez d’abord ${challenge==='the normal trail'?'le parcours normal':`la ${translate(challenge)}`}.`],
  [/(\d+) \/ (\d+) illustrations ready/g, (_,n,total)=>`${n} / ${total} illustrations prêtes`],
  [/(\d+) \/ (\d+) species discovered\. Meet wild Pokémon and explore each partner's evolution line\./g, (_,n,total)=>`${n} / ${total} espèces découvertes. Rencontrez des Pokémon sauvages et découvrez les évolutions de vos partenaires.`],
  [/Expedition: (\d+) damage dealt · (\d+) critical hits\./g, (_,damage,hits)=>`Expédition : ${damage} dégâts infligés · ${hits} coups critiques.`],
  [/Your (.+?) plan guided this expedition(?: at Threat (\d+))?\./g, (_,plan,threat)=>`Votre stratégie ${translate(plan)} a guidé l’expédition${threat?` en Menace ${threat}`:''}.`],
  [/(Predator|Warden|Siphon) plan is choosing the next step…/g, (_,plan)=>`La stratégie ${translate(plan)} choisit la prochaine étape…`],
  [/Reforged the offered boons for (\d+) gold\. (\d+) reforges remain\./g, (_,gold,n)=>`Bonus reforgés pour ${gold} pièces d’or. Reforges restantes : ${n}.`],
  [/The shrine accepts (\d+) HP for two boon ranks\./g, (_,hp)=>`Le sanctuaire accepte ${hp} PV contre deux rangs de bonus.`],
  [/Victory! \+(\d+) gold, \+(\d+) experience\./g, (_,gold,xp)=>`Victoire ! +${gold} or, +${xp} expérience.`],
  [/The satchel held (\d+) gold\./g, (_,gold)=>`La sacoche contenait ${gold} pièces d’or.`],
  [/(.+) scouted: your opening strike deals 25% more damage\./g, (_,name)=>`${translate(name)} repéré : votre première frappe inflige 25 % de dégâts supplémentaires.`],
  [/(.+) expedition plan selected\./g, (_,name)=>`Stratégie ${translate(name)} sélectionnée.`],
  [/(.+) purchased\./g, (_,name)=>`Achat : ${translate(name)}.`],
  [/REGION (\d+) OF (\d+)/g, (_,n,total)=>`RÉGION ${n} SUR ${total}`],
  [/Scouted: /g, ()=>'Repéré : '],
  [/On the way to /g, ()=>'En route vers '],
];
export function translate(value) {
  const source = String(value);
  if (locale !== 'fr' || !source.trim()) return source;
  const core = source.trim();
  if (Object.hasOwn(dictionary,core)) return source.replace(core,dictionary[core]);
  let result = source;
  for (const [pattern, replacement] of templates) result = result.replace(pattern,replacement);
  return result.replace(phrases, phrase => dictionary[phrase]);
}

export class PresentationLocalizer {
  constructor(root) {
    this.root = root; this.textSources = new WeakMap(); this.attributeSources = new WeakMap();
    this.observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') this.text(record.target);
        else if (record.type === 'attributes') this.attributes(record.target);
        else for (const node of record.addedNodes) this.apply(node);
      }
      // Discard only the mutations made synchronously by this translation pass.
      this.observer.takeRecords();
    });
    this.observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['alt','aria-label','title']});
  }
  text(node) {
    if (node.parentElement?.closest('script,style,[data-no-translate]')) return;
    const previous=this.textSources.get(node),source=node.parentElement?.dataset.i18nSource||(previous&&node.nodeValue===previous.output?previous.source:node.nodeValue),output=translate(source);
    this.textSources.set(node,{source,output});
    if (node.nodeValue!==output) node.nodeValue=output;
  }
  attributes(node) {
    if (node.nodeType!==1 || node.closest('[data-no-translate]')) return;
    const cache=this.attributeSources.get(node)||{};
    for (const name of ['alt','aria-label','title']) if(node.hasAttribute(name)) {
      const value=node.getAttribute(name),previous=cache[name],source=previous&&value===previous.output?previous.source:value,output=translate(source);
      cache[name]={source,output};if(value!==output)node.setAttribute(name,output);
    }
    this.attributeSources.set(node,cache);
  }
  apply(root=this.root) {
    if (root.nodeType===3) {this.text(root);return;}
    if(root.nodeType!==1)return;
    this.attributes(root);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
    let node;while((node=walker.nextNode())){if(node.nodeType===3)this.text(node);else this.attributes(node);}
  }
  refresh() {
    this.apply();this.observer.takeRecords();
    document.documentElement.lang=locale;
    document.title=translate('PokéRogue — The Guardian Trail');
  }
}
