package app.kalorientracker;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

// Startbildschirm-Widget: die heutigen Kalorien, ein Tipp öffnet die Kamera. Nur die Zahl, kein Ziel und keine Wertung.
public class KalorienWidgetProvider extends AppWidgetProvider {
    private static final String PREFS = "kalorien_widget";
    private static final String KEY_KCAL = "kcal";
    private static final String KEY_DATE = "dateKey";

    static void save(Context context, int kcal, String dateKey) {
        prefs(context).edit().putInt(KEY_KCAL, kcal).putString(KEY_DATE, dateKey).apply();
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, KalorienWidgetProvider.class));
        for (int id : ids) manager.updateAppWidget(id, views(context));
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, views(context));
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static RemoteViews views(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_kalorien);
        views.setTextViewText(R.id.widget_kcal, context.getString(R.string.widget_kcal_value, todayKcal(context)));

        Intent intent = new Intent(context, MainActivity.class)
            .setAction(MainActivity.ACTION_WIDGET_CAMERA)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, intent, flags));
        return views;
    }

    // Stammt die Zahl von gestern, gilt für heute 0.
    private static int todayKcal(Context context) {
        SharedPreferences prefs = prefs(context);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        return today.equals(prefs.getString(KEY_DATE, "")) ? prefs.getInt(KEY_KCAL, 0) : 0;
    }
}
