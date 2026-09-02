import 'package:flutter/material.dart';

import '../../domain/content_models.dart';
import 'home_destination_spec.dart';

export 'home_destination_spec.dart' show HomeDestinationIndex, HomeDestinationSpec;

/// Thin backward-compatible wrapper over [buildHomeDestinationSpecs].
///
/// `HomeDestinationSpec` (spec app-foundation-family-journey, Requirement 3)
/// is now the single source of truth for each destination's label, icon and
/// body. This function only exists so existing call sites
/// (`adaptive_home_shell.dart`, `tv_home_shell.dart`) that just want the built
/// widgets keep working without change.
List<Widget> buildHomeDestinations({
  required HomeCatalog catalog,
  required bool isTelevision,
  String? selectedPlanetId,
  ValueChanged<String>? onOpenPlanet,
  ValueChanged<int>? onSelectDestination,
  VoidCallback? onOpenPortal,
}) {
  return buildHomeDestinationSpecs(
    catalog: catalog,
    isTelevision: isTelevision,
    selectedPlanetId: selectedPlanetId,
    onOpenPlanet: onOpenPlanet,
    onSelectDestination: onSelectDestination,
    onOpenPortal: onOpenPortal,
  ).map((spec) => spec.build()).toList();
}
