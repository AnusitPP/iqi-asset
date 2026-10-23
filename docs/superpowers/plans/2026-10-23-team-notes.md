# Team and notes editing

Use existing ทีม column in Appscriptdata. User explicitly authorized a new หมายเหตุ column while retaining หมายเหตุเดิมในชีต. Existing details fields render an editable team select and notes textarea with one save button. PUT /api/dashboard/:row/details validates team choices and note length, serializes with status/photo writes, checks revision and re-reads saved values. Writes use stringValue and touch only changed cells. No inspection timestamp changes. Unit and authenticated HTTP tests verify revision conflicts and preservation of original notes and photos.
