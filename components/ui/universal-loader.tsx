import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Column configuration for table variant
export type ColumnConfig = {
  type: "icon-text" | "text" | "badge" | "button";
  width?: string;
};

// Variant-specific configurations
export type TableConfig = {
  columns: ColumnConfig[];
  showHeader?: boolean;
};

export type CardsConfig = {
  cardHeight?: string;
  showImage?: boolean;
  imageSize?: string;
};

export type ListConfig = {
  itemHeight?: string;
  showIcon?: boolean;
};

export type GridConfig = {
  columns?: number;
  cardHeight?: string;
};

export type CustomConfig = {
  renderItem: (index: number) => React.ReactNode;
};

// Main props type
export type UniversalLoaderProps = {
  variant: "table" | "cards" | "list" | "grid" | "custom";
  rows?: number;
  className?: string;
} & (
  | { variant: "table"; config: TableConfig }
  | { variant: "cards"; config?: CardsConfig }
  | { variant: "list"; config?: ListConfig }
  | { variant: "grid"; config?: GridConfig }
  | { variant: "custom"; config: CustomConfig }
);

// Table variant component
function TableVariant({ rows, config }: { rows: number; config: TableConfig }) {
  const { columns, showHeader = true } = config;

  const renderCell = (columnConfig: ColumnConfig, index: number) => {
    switch (columnConfig.type) {
      case "icon-text":
        return (
          <TableCell key={index}>
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-6 rounded" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </TableCell>
        );
      case "badge":
        return (
          <TableCell key={index}>
            <Skeleton className="h-6 w-16" />
          </TableCell>
        );
      case "button":
        return (
          <TableCell key={index}>
            <Skeleton className="h-8 w-24" />
          </TableCell>
        );
      case "text":
      default:
        return (
          <TableCell key={index}>
            <Skeleton className={cn("h-4", columnConfig.width || "w-20")} />
          </TableCell>
        );
    }
  };

  return (
    <Table>
      {showHeader && (
        <TableHeader>
          <TableRow>
            {columns.map((_, index) => (
              <TableHead key={index}>
                <Skeleton className="h-4 w-16" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      )}
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            {columns.map((col, colIndex) => renderCell(col, colIndex))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Cards variant component
function CardsVariant({
  rows,
  config = {},
}: {
  rows: number;
  config?: CardsConfig;
}) {
  const {
    cardHeight = "auto",
    showImage = true,
    imageSize = "w-20 h-20",
  } = config;

  return (
    <div className="space-y-6">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "p-6 border rounded-lg",
            cardHeight !== "auto" && cardHeight
          )}
        >
          <div className="flex items-start gap-4">
            {showImage && (
              <Skeleton className={cn(imageSize, "rounded-lg flex-shrink-0")} />
            )}
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <div className="flex gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// List variant component
function ListVariant({
  rows,
  config = {},
}: {
  rows: number;
  config?: ListConfig;
}) {
  const { itemHeight = "h-auto", showIcon = false } = config;

  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn("flex justify-between items-center", itemHeight)}
        >
          {showIcon && <Skeleton className="h-4 w-4 rounded-full mr-2" />}
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

// Grid variant component
function GridVariant({
  rows,
  config = {},
}: {
  rows: number;
  config?: GridConfig;
}) {
  const { columns = 4, cardHeight = "h-24" } = config;

  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  }[columns] || "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={cn("grid gap-4", gridCols)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn("rounded-lg", cardHeight)} />
      ))}
    </div>
  );
}

// Custom variant component
function CustomVariant({
  rows,
  config,
}: {
  rows: number;
  config: CustomConfig;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <React.Fragment key={i}>{config.renderItem(i)}</React.Fragment>
      ))}
    </>
  );
}

// Main UniversalLoader component
export function UniversalLoader(props: UniversalLoaderProps) {
  const { variant, rows: rowsProp, className } = props;

  // Default rows based on variant
  const defaultRows = variant === "table" ? 8 : 5;
  const rows = rowsProp ?? defaultRows;

  const content = (() => {
    switch (variant) {
      case "table":
        return <TableVariant rows={rows} config={props.config} />;
      case "cards":
        return <CardsVariant rows={rows} config={props.config} />;
      case "list":
        return <ListVariant rows={rows} config={props.config} />;
      case "grid":
        return <GridVariant rows={rows} config={props.config} />;
      case "custom":
        return <CustomVariant rows={rows} config={props.config} />;
      default:
        return null;
    }
  })();

  return <div className={className}>{content}</div>;
}
