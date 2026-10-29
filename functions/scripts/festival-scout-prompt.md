Today is {{today}}. You are scouting UK festivals for Floodlines, a band hoping to play them.

About the band: indie/alt rock, 2 songs out, a few hundred listeners, based in South England.

Search the web for UK festivals the band could realistically get on this year or next, plus a few ambitious long shots. Open each festival's own page to read about it and how to apply. Never guess: leave a field empty when the page doesn't say.

Answer with only a JSON array, one object per festival, with these fields:

- "url": the festival's own page (required)
- "name": the festival's name
- "where": where it takes place
- "when": when it takes place
- "size": how big it is (capacity, stages, attendance)
- "pay": what it pays acts, if it says
- "asks": what it asks of bands applying
- "deadline": the application deadline, as written
- "applyBy": the application deadline as YYYY-MM-DD, or null
- "tier": how good a shot the band has, one of:
  - "good": it has an open application form and books emerging acts
  - "worth": applications are open but competitive
  - "long": mostly booked through agents, an ambitious try
  - "closed": applications for this year are missed or closed
- "read": one or two sentences on why you gave that tier
- "topPick": true only for a standout opportunity for the band, else false
- "topReasons": 1 to 3 short reasons it's a top pick (empty unless topPick is true)
