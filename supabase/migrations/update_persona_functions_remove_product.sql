-- Update update_persona_jsonld to remove product references
CREATE OR REPLACE FUNCTION update_persona_jsonld()
RETURNS trigger AS $$
BEGIN
  NEW.persona_jsonld :=
    '{' ||
    '"coreValue": "' || COALESCE(NEW.core_brand_value, '') || '", ' ||
    '"toneOfVoice": "' || COALESCE(NEW.brand_tone_of_voice, '') || '", ' ||
    '"archetype": "' || COALESCE(NEW.brand_archetype, '') || '", ' ||
    '"customerEmotion": "' || COALESCE(NEW.customer_emotions, '') || '", ' ||
    '"formality": "' || COALESCE(NEW.communication_style, '') || '", ' ||
    '"humorStyle": "' || COALESCE(NEW.brand_voice_humor, '') || '", ' ||
    '"languageComplexity": "' || COALESCE(NEW.language_complexity, '') || '", ' ||
    '"emotionallyExpressive": "' || COALESCE(NEW.emotional_expressiveness, '') || '", ' ||
    '"wordsToAvoid": "' || COALESCE(NEW.words_to_avoid, '') || '", ' ||
    '"addressCustomers": "' || COALESCE(NEW.customer_address_style, '') || '", ' ||
    '"communicationPurpose": "' || COALESCE(NEW.brand_communication_purpose, '') || '", ' ||
    '"visualMetaphor": "' || COALESCE(NEW.brand_visual_metaphor, '') || '", ' ||
    '"languageRegion": "' || COALESCE(NEW.language_region_preference, '') || '", ' ||
    '"competitorVoiceContrast": "' || COALESCE(NEW.competitor_voice_contrast, '') || '", ' ||
    '"contentGuidelines": "' || COALESCE(NEW.content_dos_and_donts, '') || '", ' ||
    '"writtenBy": "' || COALESCE(NEW.copywriter_type, '') || '"' ||
    '}';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update update_persona_summary to remove product references
CREATE OR REPLACE FUNCTION update_persona_summary()
RETURNS trigger AS $$
BEGIN
  NEW.persona_summary :=
    'Core value: ' || COALESCE(NEW.core_brand_value, '') ||
    '. Tone of voice: ' || COALESCE(NEW.brand_tone_of_voice, '') ||
    '. Archetype: ' || COALESCE(NEW.brand_archetype, '') ||
    '. Customers should feel: ' || COALESCE(NEW.customer_emotions, '') ||
    '. Formality: ' || COALESCE(NEW.communication_style, '') ||
    '. Humor style: ' || COALESCE(NEW.brand_voice_humor, '') ||
    '. Language complexity: ' || COALESCE(NEW.language_complexity, '') ||
    '. Words to avoid: ' || COALESCE(NEW.words_to_avoid, '') ||
    '. Communication purpose: ' || COALESCE(NEW.brand_communication_purpose, '') ||
    '. Visual metaphor: ' || COALESCE(NEW.brand_visual_metaphor, '') ||
    '. Language & region: ' || COALESCE(NEW.language_region_preference, '') ||
    '. Competitor voice contrast: ' || COALESCE(NEW.competitor_voice_contrast, '') ||
    '. Content guidelines: ' || COALESCE(NEW.content_dos_and_donts, '') ||
    '. Created by: ' || COALESCE(NEW.copywriter_type, '') || '.';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql; 