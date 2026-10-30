/* LangBlue Kazakh morphology engine.
 * Suffix selection is rule-based and intentionally isolated so linguistic
 * exceptions can be added without changing the product UI.
 */
export const KzHarmony = (() => {
  const BACK_VOWELS = new Set(['а','о','ұ','ы']);
  const FRONT_VOWELS = new Set(['ә','ө','ү','і','е','и']);
  const VOWELS = new Set([...BACK_VOWELS, ...FRONT_VOWELS, 'у']);
  const VOICELESS = new Set(['п','ф','к','қ','т','с','ш','х','һ','ц','ч','щ']);
  const NASAL = new Set(['м','н','ң']);
  const VOICED_D = new Set(['б','в','г','ғ','д','ж','з','л']);
  const SONORANT_L = new Set(['й','р','у']);

  function clean(value) { return String(value || '').trim().toLowerCase(); }
  function lastVowel(word) {
    const chars = Array.from(clean(word));
    for (let i = chars.length - 1; i >= 0; i--) if (VOWELS.has(chars[i])) return chars[i];
    return null;
  }
  function isBack(vowel) {
    if (vowel === 'у') return true;
    return BACK_VOWELS.has(vowel);
  }
  function harmonyOf(word) {
    const vowel = lastVowel(word);
    return vowel && isBack(vowel) ? 'back' : 'front';
  }
  function lastChar(word) { return Array.from(clean(word)).at(-1) || ''; }
  function endsWithVoiceless(word) { return VOICELESS.has(lastChar(word)); }
  function pluralSuffix(root) {
    const v = lastVowel(root);
    const vowelClass = v && isBack(v) ? 'back' : 'front';
    const end = lastChar(root);
    const ending = VOICELESS.has(end) ? 'т'
      : (NASAL.has(end) || VOICED_D.has(end)) ? 'д'
      : SONORANT_L.has(end) || VOWELS.has(end) ? 'л' : 'л';
    return ending + (vowelClass === 'back' ? 'а' : 'е') + 'р';
  }
  function selectPair(root, back, front) { return harmonyOf(root) === 'back' ? back : front; }
  function possessiveSuffix(stem, person) {
    const end = lastChar(stem);
    const vowelEnding = VOWELS.has(end);
    const pair = (back, front) => selectPair(stem, back, front);
    if (person === '1sg') return vowelEnding ? 'м' : pair('ым','ім');
    if (person === '2sg') return vowelEnding ? 'ң' : pair('ың','ің');
    if (person === '3sg') return vowelEnding ? pair('сы','сі') : pair('ы','і');
    return '';
  }
  function caseSuffix(stem, caseName) {
    const end = lastChar(stem), back = harmonyOf(stem) === 'back';
    const v = back ? 'а' : 'е';
    const i = back ? 'ы' : 'і';
    const voiceless = VOICELESS.has(end);
    const nasal = NASAL.has(end);
    const voiced = !voiceless;
    switch (caseName) {
      case 'genitive': return nasal || VOWELS.has(end) ? (back ? 'ның':'нің') : (voiceless ? (back?'тың':'тің') : (back?'дың':'дің'));
      case 'dative': return voiceless ? (back?'қа':'ке') : (back?'ға':'ге');
      case 'accusative': return nasal || VOWELS.has(end) ? (back?'ны':'ні') : (voiceless ? (back?'ты':'ті') : (back?'ды':'ді'));
      case 'locative': return voiceless ? (back?'та':'те') : (back?'да':'де');
      case 'ablative': return nasal ? (back?'нан':'нен') : voiceless ? (back?'тан':'тен') : (back?'дан':'ден');
      case 'instrumental': return voiceless ? 'пен' : (VOWELS.has(end) ? 'мен' : (back?'бен':'бен'));
      default: return '';
    }
  }
  function inflect(root, options = {}) {
    const base = clean(root);
    if (!base) return { form:'', chain:[], harmony:'front', lastVowel:null, endsWithVoiceless:false };
    let form = base;
    const chain = [];
    if (options.plural) {
      const suffix = pluralSuffix(form); form += suffix; chain.push(suffix);
    }
    if (options.possessive) {
      const alternations = { 'п':'б', 'к':'г', 'қ':'ғ' };
      const end = lastChar(form);
      if (alternations[end]) form = form.slice(0, -1) + alternations[end];
    }
    if (options.possessive) {
      const suffix = possessiveSuffix(form, options.possessive);
      if (suffix) { form += suffix; chain.push(suffix); }
    }
    if (options.caseName) {
      const suffix = caseSuffix(form, options.caseName);
      if (suffix) { form += suffix; chain.push(suffix); }
    }
    return { form, chain, harmony:harmonyOf(base), lastVowel:lastVowel(base), endsWithVoiceless:endsWithVoiceless(base) };
  }
  return { lastVowel, isBack, harmonyOf, endsWithVoiceless, pluralSuffix, possessiveSuffix, caseSuffix, inflect };
})();
if (typeof window !== 'undefined') window.LangBlueKzHarmony = KzHarmony;
