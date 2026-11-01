# TB Cosmetology – טניה בקאי

אתר לקליניקה לקוסמטיקה וטיפולי עור בשכונת אגמים, נתניה. האתר כולל מערכת לבקשת תורים ואישורים בוואטסאפ.

## מבנה הפרויקט

```
index.html              דף הבית (עברית, RTL, מותאם קודם לנייד)
privacy.html            מדיניות פרטיות
assets/
  css/styles.css        העיצוב
  js/config.js          פרטי העסק, נושאי הייעוץ, ימי עבודה, המלצות – הכול במקום אחד
  js/main.js            תפריט, חלון פרטי טיפול, הגדלת תמונות, המלצות
  js/booking.js         טופס קביעת פגישת ייעוץ
  images/originals/     התמונות המקוריות מטניה, ללא שינוי
  images/*-720|1320.*   גרסאות לאתר (שינוי גודל ודחיסה בלבד, WebP ו-JPG)
api/                    שרת (Vercel Functions, Node 20, ללא ספריות חיצוניות)
  booking.js            קבלת בקשה → שמירה → התראות בוואטסאפ
  booking-action.js     עמוד לטניה לאישור או דחייה של בקשה
  availability.js       שעות פנויות מיומן Google (רק אם מחובר)
  reminders.js          תזכורות יומיות לתורים מאושרים
  _lib/                 ולידציה, מאגר (Supabase), וואטסאפ (Meta Cloud API), יומן Google
supabase/schema.sql     טבלת הבקשות
tests/                  בדיקות (npm test)
docs/SETUP.md           מדריך חיבור: אחסון, מאגר, וואטסאפ, יומן
```

## טכנולוגיה

- **אתר:** HTML, CSS ו-JavaScript, בלי פריימוורק ובלי שלב build. נטען מהר ומתאים לכל אחסון.
- **שרת:** פונקציות Serverless ב-Vercel.
- **מאגר:** Supabase (Postgres), עם גישה מהשרת בלבד.
- **הודעות:** WhatsApp Business Cloud API.
- **יומן:** Google Calendar (אופציונלי).

הוראות ההפעלה המלאות נמצאות ב-[docs/SETUP.md](docs/SETUP.md).
