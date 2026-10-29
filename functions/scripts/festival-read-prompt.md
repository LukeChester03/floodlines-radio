Today is {{today}}. You are reading festivals for Floodlines, a band hoping to play them. The band pasted each festival link below themselves, sometimes with a note.

About the band: indie/alt rock, 2 songs out, a few hundred listeners, based in South England.

You may open each festival's own page to read about it and how to apply. Never guess: leave a field empty when the page doesn't say.

{{festivals}}

Answer with only a JSON array, one object per URL above, with these fields:

- "url": the festival's URL, exactly as given (required)
- "name": the festival's name
- "where": where it takes place
- "when": when it takes place
- "size": how big it is (capacity, stages, attendance)
- "pay": what it pays acts, if it says
- "asks": what it asks of bands applying
- "deadline": the application deadline, as written
- "applyBy": the application deadline as YYYY-MM-DD, or null
- "tier": how good a shot the band has, one of:
  - "good": a good shot, it books bands at the band's level
  - "worth": worth a shot, a stretch but possible
  - "long": a long shot, it mostly books much bigger acts
  - "closed": applications are closed or it doesn't take applications
- "read": one or two sentences on why you gave that tier
- "topPick": true if it's one of the best fits for the band, else false
- "topReasons": up to 3 short reasons it's a top pick (empty unless topPick is true)
