-- Short, editorially verified descriptions of what each company does.
ALTER TABLE company ADD COLUMN IF NOT EXISTS business_summary text;

UPDATE company SET business_summary = '가상의 소프트웨어 기업입니다. 개발·구독 서비스를 제공하는 데모 데이터입니다.'
WHERE sec_cik = 'DEMO000001' AND business_summary IS NULL;

UPDATE company SET business_summary = '가상의 산업재 기업입니다. 제조·설비 사업을 하는 데모 데이터입니다.'
WHERE sec_cik = 'DEMO000002' AND business_summary IS NULL;
