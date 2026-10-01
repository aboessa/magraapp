/// `timeline_map` — placing an event in time, in place, or both.
///
/// Contract: `docs/games/engines/12-timeline-map.md`, level shape
/// `docs/games/schemas/timeline_map.v1.schema.json`.
///
/// ## Two mirroring rules that pull in opposite directions
///
/// «خط الزمن **يُعكس** في RTL؛ الخريطة **لا تُعكس** أبدًا.» The timeline is
/// mirrored in RTL because it reads like a line of text. The map is never
/// mirrored, because geography is not a reading order — a mirrored Middle East is
/// simply wrong. So the two surfaces are wrapped in *different* directionalities on
/// purpose, and `mirror_in_rtl` is pinned to false in the schema so a pack cannot
/// ask otherwise.
///
/// ## Calendars
///
/// Years are stored Gregorian, always. Hijri is a display conversion computed at
/// render time by [hijriYearForGregorian] and never written anywhere. The contract
/// states the displayed value must never be stored as durable data, so there is no
/// field on any model here that holds it.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'game_art.dart';
import 'game_board_kit.dart';
import 'game_engine_registry.dart';
import 'game_services.dart';
import 'game_session_controller.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

/// Approximate Hijri year for a Gregorian one.
///
/// The lunar year is about 0.97 of a solar year. This is the standard arithmetic
/// approximation and is adequate for a century-scale timeline label; it is
/// deliberately not used for anything but a label.
int hijriYearForGregorian(int gregorianYear) {
  if (gregorianYear < 622) return 0;
  return ((gregorianYear - 622) / 0.970229).round() + 1;
}

final _arabicOrdinals = [
  '',
  AppLocalizationsAr().gamestimelinemapengineHijriYearForGregorian01,
  AppLocalizationsAr().gamestimelinemapengineHijriYearForGregorian02,
  AppLocalizationsAr().gamestimelinemapengineHijriYearForGregorian03,
  AppLocalizationsAr().gamestimelinemapengineHijriYearForGregorian04,
  AppLocalizationsAr().gamestimelinemapengineHijriYearForGregorian05,
  AppLocalizationsAr().gamestimelinemapengineHijriYearForGregorian06,
  AppLocalizationsAr().gamestimelinemapengineHijriYearForGregorian07,
  AppLocalizationsAr().gamestimelinemapengineHijriYearForGregorian08,
  AppLocalizationsAr().gamestimelinemapengineHijriYearForGregorian09,
  AppLocalizationsAr().gamestimelinemapengineHijriYearForGregorian10,
  AppLocalizationsAr().gamestimelinemapengineHijriYearForGregorian11,
  AppLocalizationsAr().gamestimelinemapengineHijriYearForGregorian12,
  AppLocalizationsAr().gamestimelinemapengineHijriYearForGregorian13,
  'الرابع عشر',
  'الخامس عشر',
  'السادس عشر',
  'السابع عشر',
  'الثامن عشر',
  'التاسع عشر',
  'العشرون',
  'الحادي والعشرون',
];

/// A spoken-language description of a year, e.g. «القرن الثامن الميلادي».
///
/// The contract asks for a text description of every position, which is what makes
/// the timeline usable without seeing it.
String centuryDescription(int year) {
  if (year <= 0) return 'قبل الميلاد';
  final century = ((year - 1) ~/ 100) + 1;
  final ordinal = century < _arabicOrdinals.length
      ? _arabicOrdinals[century]
      : '$century';
  return 'القرن $ordinal الميلادي';
}

/// Bounds for the named map regions.
///
/// The pack names a region and a projection but carries no bounding box, and an
/// equirectangular projection cannot be drawn without one. Known regions are listed
/// here; anything else falls back to the whole world, which is wrong-looking rather
/// than silently mis-plotting a point.
class MapBounds {
  const MapBounds({
    required this.minLat,
    required this.maxLat,
    required this.minLon,
    required this.maxLon,
  });

  final double minLat;
  final double maxLat;
  final double minLon;
  final double maxLon;

  static final world = MapBounds(
    minLat: -60,
    maxLat: 80,
    minLon: -180,
    maxLon: 180,
  );

  static final _known = <String, MapBounds>{
    'middle_east_north_africa': MapBounds(
      minLat: 10,
      maxLat: 42,
      minLon: -18,
      maxLon: 63,
    ),
    'arab_world': MapBounds(minLat: 10, maxLat: 40, minLon: -18, maxLon: 60),
    'world': world,
  };

  static MapBounds forRegion(String region) => _known[region] ?? world;

  /// Fractional x/y for a coordinate, 0..1 from the top-left.
  (double, double) project(double lat, double lon) {
    final x = ((lon - minLon) / (maxLon - minLon)).clamp(0.0, 1.0);
    final y = (1 - (lat - minLat) / (maxLat - minLat)).clamp(0.0, 1.0);
    return (x, y);
  }

  /// Inverse, for turning a tap into a coordinate.
  (double, double) unproject(double fx, double fy) {
    final lon = minLon + fx * (maxLon - minLon);
    final lat = minLat + (1 - fy) * (maxLat - minLat);
    return (lat, lon);
  }
}

/// Great-circle distance in kilometres.
double distanceKm(double lat1, double lon1, double lat2, double lon2) {
  final earthRadiusKm = 6371.0;
  double toRad(double d) => d * math.pi / 180;
  final dLat = toRad(lat2 - lat1);
  final dLon = toRad(lon2 - lon1);
  final a =
      math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(toRad(lat1)) *
          math.cos(toRad(lat2)) *
          math.sin(dLon / 2) *
          math.sin(dLon / 2);
  return 2 * earthRadiusKm * math.atan2(math.sqrt(a), math.sqrt(1 - a));
}

class TimelineEvent {
  const TimelineEvent({
    required this.id,
    required this.labelKey,
    required this.image,
    this.label = '',
    this.year,
    this.toleranceYears,
    this.lat,
    this.lon,
    this.toleranceKm,
    this.explainKey,
  });

  factory TimelineEvent.fromJson(Map<String, dynamic> json) => TimelineEvent(
    id: str(json, 'id'),
    labelKey: str(json, 'label_key'),
    label: str(json, 'label'),
    image: str(json, 'image'),
    year: json['year'] is num ? (json['year'] as num).toInt() : null,
    toleranceYears: json['tolerance_years'] is num
        ? (json['tolerance_years'] as num).toInt()
        : null,
    lat: json['lat'] is num ? (json['lat'] as num).toDouble() : null,
    lon: json['lon'] is num ? (json['lon'] as num).toDouble() : null,
    toleranceKm: json['tolerance_km'] is num
        ? (json['tolerance_km'] as num).toInt()
        : null,
    explainKey: json['explain_key'] is String
        ? json['explain_key'] as String
        : null,
  );

  final String id;
  final String labelKey;
  final String label;
  final String image;
  final int? year;
  final int? toleranceYears;
  final double? lat;
  final double? lon;
  final int? toleranceKm;
  final String? explainKey;
}

class TimelineMapEngine extends GameEngine {
  const TimelineMapEngine();

  @override
  String get engineId => 'timeline_map';

  /// Fine-adjust buttons make both surfaces reachable without a pointer, and the
  /// contract marks `supports_dpad` true.
  @override
  bool get supportsDpad => true;

  @override
  Widget build(BuildContext context, GameSessionController controller) =>
      _TimelineMapSurface(controller: controller);
}

class _TimelineMapSurface extends StatefulWidget {
  const _TimelineMapSurface({required this.controller});
  final GameSessionController controller;

  @override
  State<_TimelineMapSurface> createState() => _TimelineMapSurfaceState();
}

class _TimelineMapSurfaceState extends State<_TimelineMapSurface> {
  int _eventIndex = 0;
  int _wrongAttempts = 0;
  int _correctFirstTry = 0;
  bool _anyHelpUsed = false;
  bool _showAnchor = false;
  String? _retryMessage;
  IconData? _retryIcon;

  /// The child's current guess for the active event.
  int? _guessYear;
  double? _guessLat;
  double? _guessLon;

  /// Set once the year is accepted in `both` mode, so the map stage follows.
  bool _yearAccepted = false;

  /// Narrowed display range, applied at the second rung.
  int? _narrowFrom;
  int? _narrowTo;

  Map<String, dynamic> get _level => widget.controller.rawLevel;
  String get _mode => str(_level, 'mode');

  Map<String, dynamic> get _timeline {
    final raw = _level['timeline'];
    return raw is Map ? Map<String, dynamic>.from(raw) : const {};
  }

  Map<String, dynamic> get _map {
    final raw = _level['map'];
    return raw is Map ? Map<String, dynamic>.from(raw) : const {};
  }

  List<TimelineEvent> get _events =>
      mapList(_level['events']).map(TimelineEvent.fromJson).toList();

  TimelineEvent? get _event =>
      _eventIndex < _events.length ? _events[_eventIndex] : null;

  int get _from => _narrowFrom ?? intOr(_timeline, 'from', 0);
  int get _to => _narrowTo ?? intOr(_timeline, 'to', 2000);
  String get _displayCalendar {
    final value = _timeline['display_calendar'];
    return value is String ? value : 'auto';
  }

  MapBounds get _bounds => MapBounds.forRegion(str(_map, 'region'));

  bool get _needsYear => _mode == 'timeline' || _mode == 'both';
  bool get _needsPlace => _mode == 'map' || _mode == 'both';

  String _eventLabel(TimelineEvent event) {
    return safeChildFacingLabel(
      authoredText: event.label,
      technicalId: event.labelKey,
      artId: event.image,
      arabicFallback: 'حدث تاريخي',
    );
  }

  /// The year label, converted for display only.
  ///
  /// `hijri` shows the Hijri year alone. `auto` shows both, because the pack
  /// carries no region signal and an Arabic-reading child is served by seeing the
  /// correspondence rather than one calendar silently chosen for them. Neither
  /// form is ever written back: [hijriYearForGregorian] is called here and nowhere
  /// that persists.
  String _yearLabel(int year) {
    switch (_displayCalendar) {
      case 'hijri':
        return '${hijriYearForGregorian(year)} هـ';
      case 'gregorian':
        return '$year م';
      default:
        final hijri = hijriYearForGregorian(year);
        return hijri <= 0 ? '$year م' : '$year م · $hijri هـ';
    }
  }

  Future<void> _submitYear() async {
    final event = _event;
    final guess = _guessYear;
    if (event == null || guess == null) return;
    final tolerance = event.toleranceYears ?? 50;
    final target = event.year ?? 0;
    if ((guess - target).abs() <= tolerance) {
      if (_needsPlace && _mode == 'both') {
        setState(() => _yearAccepted = true);
        return;
      }
      await _accept();
      return;
    }
    await _wrong(olderThanGuess: target < guess);
  }

  Future<void> _submitPlace() async {
    final event = _event;
    final lat = _guessLat, lon = _guessLon;
    if (event == null || lat == null || lon == null) return;
    final tolerance = (event.toleranceKm ?? 200).toDouble();
    final km = distanceKm(lat, lon, event.lat ?? 0, event.lon ?? 0);
    if (km <= tolerance) {
      await _accept();
      return;
    }
    await _wrong(eastOfGuess: (event.lon ?? 0) > lon);
  }

  Future<void> _accept() async {
    if (_wrongAttempts == 0) _correctFirstTry++;
    widget.controller.feedback.emit(
      FeedbackEvent.strokeComplete,
      track: widget.controller.ageTrack,
    );
    final event = _event;
    if (event?.explainKey != null) {
      await widget.controller.speakVoiceKey(event!.explainKey!);
    }
    await _nextEvent();
  }

  /// Directional guidance, which is what the contract's error table specifies —
  /// an arrow and a direction, never a rejection.
  Future<void> _wrong({bool? olderThanGuess, bool? eastOfGuess}) async {
    _wrongAttempts++;
    _anyHelpUsed = true;
    final event = _event;
    setState(() {
      if (olderThanGuess != null) {
        _retryMessage = olderThanGuess
            ? 'اتجه إلى زمن أقدم ثم جرّب مرة أخرى'
            : 'اتجه إلى زمن أحدث ثم جرّب مرة أخرى';
        _retryIcon = olderThanGuess
            ? Icons.history_rounded
            : Icons.update_rounded;
      } else if (eastOfGuess != null) {
        _retryMessage = eastOfGuess
            ? 'حرّك العلامة شرقًا ثم جرّب مرة أخرى'
            : 'حرّك العلامة غربًا ثم جرّب مرة أخرى';
        _retryIcon = eastOfGuess ? Icons.east_rounded : Icons.west_rounded;
      } else {
        _retryMessage = 'عدّل الموضع ثم جرّب مرة أخرى';
        _retryIcon = Icons.refresh_rounded;
      }
    });

    switch (_wrongAttempts) {
      case 1:
        if (olderThanGuess != null) {
          await widget.controller.speakVoiceKey(
            olderThanGuess ? 'vo.hint_older' : 'vo.hint_newer',
          );
        } else if (eastOfGuess != null) {
          await widget.controller.speakVoiceKey('vo.hint_direction');
        }
      case 2:
        // Narrow the visible range around the answer, so the target is easier to
        // hit without being given away.
        final target = event?.year;
        if (target != null) {
          final span = ((_to - _from) / 4).round().clamp(20, 400);
          setState(() {
            _narrowFrom = target - span;
            _narrowTo = target + span;
          });
        }
        await widget.controller.speakVoiceKey('vo.retry');
      case 3:
        setState(() => _showAnchor = true);
        await widget.controller.speakVoiceKey('vo.retry');
      default:
        // Placed automatically, with the historical explanation.
        setState(() {
          _guessYear = event?.year;
          _guessLat = event?.lat;
          _guessLon = event?.lon;
        });
        if (event?.explainKey != null) {
          await widget.controller.speakVoiceKey(event!.explainKey!);
        }
        await _nextEvent();
    }
    setState(() {});
  }

  Future<void> _nextEvent() async {
    if (_eventIndex + 1 >= _events.length) {
      await _finish();
      return;
    }
    setState(() {
      _eventIndex++;
      _wrongAttempts = 0;
      _guessYear = null;
      _guessLat = null;
      _guessLon = null;
      _yearAccepted = false;
      _narrowFrom = null;
      _narrowTo = null;
      _showAnchor = false;
      _retryMessage = null;
      _retryIcon = null;
    });
  }

  Future<void> _finish() async {
    await widget.controller.reportEngineAttempt(
      score: _correctFirstTry,
      maxScore: _events.length,
      helpUsed: _anyHelpUsed,
      answers: [
        {
          'mode': _mode,
          'events_total': _events.length,
          'events_correct_first_try': _correctFirstTry,
        },
      ],
    );
    await widget.controller.finishLevelFromEngine();
  }

  @override
  Widget build(BuildContext context) {
    final event = _event;
    final target = effectiveTouchTarget(widget.controller.pack.accessibility);
    if (event == null) {
      return BoardScaffold(
        controller: widget.controller,
        prompt: widget.controller.prompt,
        child: const Center(
          child: GameStatePanel(
            kind: GameStateKind.empty,
            title: 'هذا المستوى فارغ الآن',
            message: 'لا توجد أحداث للعب هنا. جرّب مستوى آخر.',
          ),
        ),
      );
    }

    final showMap = _needsPlace && (_mode == 'map' || _yearAccepted);
    return BoardScaffold(
      controller: widget.controller,
      prompt: widget.controller.prompt,
      child: SingleChildScrollView(
        child: Column(
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Directionality(
                      textDirection: TextDirection.ltr,
                      child: SizedBox.square(
                        dimension: 72,
                        child:
                            gameRoleArtPath(
                                  role: GameArtRole.event,
                                  gameId: widget.controller.gameId,
                                  assetId: event.image,
                                ) !=
                                null
                            ? ClipRRect(
                                borderRadius: BorderRadius.circular(10),
                                child: DecorativeGameArt(
                                  key: const Key('timeline_event_art'),
                                  role: GameArtRole.event,
                                  gameId: widget.controller.gameId,
                                  assetId: event.image,
                                ),
                              )
                            : gameRoleArtPath(
                                    role: GameArtRole.event,
                                    gameId: widget.controller.gameId,
                                    assetId: event.labelKey,
                                  ) !=
                                  null
                            ? ClipRRect(
                                borderRadius: BorderRadius.circular(10),
                                child: DecorativeGameArt(
                                  key: const Key('timeline_event_art'),
                                  role: GameArtRole.event,
                                  gameId: widget.controller.gameId,
                                  assetId: event.labelKey,
                                ),
                              )
                            : gameArtPath(event.image) != null
                            ? GameArt(
                                key: const Key('timeline_event_art'),
                                assetId: event.image,
                              )
                            : const Icon(Icons.event_outlined, size: 40),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _eventLabel(event),
                        key: const Key('timeline_event_label'),
                        semanticsLabel: 'الحدث: ${_eventLabel(event)}',
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                    ),
                    IconButton(
                      style: gameActionStyle(target),
                      onPressed: () =>
                          widget.controller.speakVoiceKey(event.labelKey),
                      icon: const Icon(Icons.volume_up_outlined),
                      tooltip: 'اسمع الاسم',
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            if (_needsYear && !showMap) _buildTimeline(event),
            if (showMap) _buildMap(event),
            if (_retryMessage != null) ...[
              const SizedBox(height: 10),
              Semantics(
                liveRegion: true,
                label: _retryMessage,
                child: Container(
                  key: const Key('timeline_retry_feedback'),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceContainer,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: Theme.of(context).colorScheme.primary,
                      width: 2,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(_retryIcon ?? Icons.refresh_rounded),
                      const SizedBox(width: 8),
                      Flexible(child: Text(_retryMessage!)),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildTimeline(TimelineEvent event) {
    final target = effectiveTouchTarget(widget.controller.pack.accessibility);
    final anchors = mapList(_timeline['anchors']);
    final anchor = anchors.isEmpty ? null : anchors.first;
    final anchorText = anchor == null
        ? null
        : 'مرجع: ${safeChildFacingLabel(technicalId: str(anchor, 'label_key'), arabicFallback: 'مرجع زمني')} (${_yearLabel(intOr(anchor, 'year', 0))})';
    final guess = _guessYear ?? ((_from + _to) ~/ 2);
    final span = (_to - _from).abs();

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Stack(
        children: [
          Positioned.fill(
            child: DecorativeGameArt(
              key: const Key('timeline_background_art'),
              role: GameArtRole.timeline,
              gameId: widget.controller.gameId,
            ),
          ),
          Positioned.fill(
            child: ColoredBox(
              color: Theme.of(
                context,
              ).colorScheme.surface.withValues(alpha: 0.82),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                // The timeline *is* mirrored in RTL: it reads like a line.
                Directionality(
                  textDirection: Directionality.of(context),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(_yearLabel(_from)),
                          Text(_yearLabel(_to)),
                        ],
                      ),
                      Slider(
                        key: const Key('timeline_year_slider'),
                        // Guard: when from==to, divisions must be null (continuous) to avoid RangeError max 0 in js_primitives
                        value: guess.toDouble().clamp(
                          _from.toDouble(),
                          _to == _from ? _from.toDouble() + 1 : _to.toDouble(),
                        ),
                        min: _from.toDouble(),
                        max: _from == _to
                            ? _from.toDouble() + 1
                            : _to.toDouble(),
                        divisions: span <= 1 ? null : span.clamp(1, 2000),
                        label: _yearLabel(guess),
                        onChanged: (value) =>
                            setState(() => _guessYear = value.round()),
                      ),
                    ],
                  ),
                ),
                Semantics(
                  liveRegion: true,
                  child: Text(
                    // The text description of the position, which the contract requires.
                    '${_yearLabel(guess)} — ${centuryDescription(guess)}',
                    key: const Key('timeline_position_description'),
                  ),
                ),
                if (_showAnchor && anchorText != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      anchorText,
                      key: const Key('timeline_anchor'),
                      semanticsLabel: anchorText,
                      style: Theme.of(context).textTheme.labelMedium,
                    ),
                  ),
                const SizedBox(height: 8),
                // Fine adjustment, the mandatory drag alternative.
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      style: gameActionStyle(target),
                      key: const Key('timeline_year_minus'),
                      onPressed: () => setState(
                        () => _guessYear = (guess - 1).clamp(_from, _to),
                      ),
                      icon: const Icon(Icons.remove_circle_outline),
                    ),
                    IconButton(
                      style: gameActionStyle(target),
                      key: const Key('timeline_year_plus'),
                      onPressed: () => setState(
                        () => _guessYear = (guess + 1).clamp(_from, _to),
                      ),
                      icon: const Icon(Icons.add_circle_outline),
                    ),
                  ],
                ),
                FilledButton(
                  style: gameActionStyle(target),
                  key: const Key('timeline_submit_year'),
                  onPressed: () {
                    _guessYear ??= guess;
                    _submitYear();
                  },
                  child: const Text('ضع الحدث في زمنه'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMap(TimelineEvent event) {
    final target = effectiveTouchTarget(widget.controller.pack.accessibility);
    final lat = _guessLat ?? (_bounds.minLat + _bounds.maxLat) / 2;
    final lon = _guessLon ?? (_bounds.minLon + _bounds.maxLon) / 2;
    final (fx, fy) = _bounds.project(lat, lon);

    return Column(
      children: [
        // Never mirrored. Geography is not a reading order, and `mirror_in_rtl` is
        // pinned to false in the schema.
        Directionality(
          textDirection: TextDirection.ltr,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final width = constraints.maxWidth;
              final height = width * 0.6;
              return GestureDetector(
                key: const Key('timeline_map_surface'),
                onTapDown: (details) {
                  final local = details.localPosition;
                  final (nlat, nlon) = _bounds.unproject(
                    local.dx / width,
                    local.dy / height,
                  );
                  setState(() {
                    _guessLat = nlat;
                    _guessLon = nlon;
                  });
                },
                child: SizedBox(
                  width: width,
                  height: height,
                  child: GameDecorativeSurface(
                    role: GameArtRole.map,
                    gameId: widget.controller.gameId,
                    scrimOpacity: 0.24,
                    borderRadius: BorderRadius.circular(12),
                    child: Stack(
                      children: [
                        Positioned(
                          left: fx * width - 12,
                          top: fy * height - 12,
                          child: Icon(
                            Icons.place,
                            size: 24,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        Semantics(
          liveRegion: true,
          child: Text(
            'خط العرض ${lat.toStringAsFixed(1)} · خط الطول ${lon.toStringAsFixed(1)}',
            key: const Key('timeline_map_description'),
          ),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IconButton(
              style: gameActionStyle(target),
              key: const Key('timeline_map_west'),
              onPressed: () => setState(() => _guessLon = lon - 1),
              icon: const Icon(Icons.chevron_left),
              tooltip: 'حرّك غربًا',
            ),
            IconButton(
              style: gameActionStyle(target),
              key: const Key('timeline_map_north'),
              onPressed: () => setState(() => _guessLat = lat + 1),
              icon: const Icon(Icons.expand_less),
              tooltip: 'حرّك شمالًا',
            ),
            IconButton(
              style: gameActionStyle(target),
              key: const Key('timeline_map_south'),
              onPressed: () => setState(() => _guessLat = lat - 1),
              icon: const Icon(Icons.expand_more),
              tooltip: 'حرّك جنوبًا',
            ),
            IconButton(
              style: gameActionStyle(target),
              key: const Key('timeline_map_east'),
              onPressed: () => setState(() => _guessLon = lon + 1),
              icon: const Icon(Icons.chevron_right),
              tooltip: 'حرّك شرقًا',
            ),
          ],
        ),
        FilledButton(
          style: gameActionStyle(target),
          key: const Key('timeline_submit_place'),
          onPressed: () {
            _guessLat ??= lat;
            _guessLon ??= lon;
            _submitPlace();
          },
          child: const Text('ضع الحدث في مكانه'),
        ),
      ],
    );
  }
}
