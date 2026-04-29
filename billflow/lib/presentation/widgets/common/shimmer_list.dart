import 'package:flutter/material.dart';
import 'shimmer_card.dart';

class ShimmerList extends StatelessWidget {
  final int itemCount;
  final double itemHeight;
  final EdgeInsets padding;

  const ShimmerList({
    super.key,
    this.itemCount = 6,
    this.itemHeight = 72,
    this.padding = const EdgeInsets.all(16),
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Column(
        children: List.generate(
          itemCount,
          (i) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: ShimmerCard(height: itemHeight),
          ),
        ),
      ),
    );
  }
}

class ShimmerGrid extends StatelessWidget {
  final int crossAxisCount;
  final int itemCount;
  final double itemHeight;
  final EdgeInsets padding;

  const ShimmerGrid({
    super.key,
    this.crossAxisCount = 2,
    this.itemCount = 4,
    this.itemHeight = 100,
    this.padding = const EdgeInsets.all(16),
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: crossAxisCount,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.6,
        ),
        itemCount: itemCount,
        itemBuilder: (_, __) => const ShimmerCard(),
      ),
    );
  }
}
