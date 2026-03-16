import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type HTMLAttributes,
  type MutableRefObject,
  type Ref,
} from "react";
import type { DropzoneProps, FileRejection } from "react-dropzone-esm";
import { useDropzone } from "react-dropzone-esm";

import { cn } from "@openralph/ui/lib/utils";

export type { DropzoneProps, FileRejection };

interface DropzoneContextValue {
  idle: boolean;
  accept: boolean;
  reject: boolean;
}

const DropzoneContext = createContext<DropzoneContextValue>({
  idle: true,
  accept: false,
  reject: false,
});

interface DropzoneComponentProps extends HTMLAttributes<HTMLDivElement> {
  config: DropzoneProps;
  unstyled?: boolean;
  ref?: Ref<HTMLDivElement>;
}

function Dropzone({
  config,
  children,
  className,
  unstyled = false,
  ref,
  ...props
}: DropzoneComponentProps) {
  const { getRootProps, getInputProps, isDragAccept, isDragReject, isDragActive } =
    useDropzone(config);

  const isIdle = !isDragAccept && !isDragReject;

  const contextValue = useMemo(
    () => ({ accept: isDragAccept, reject: isDragReject, idle: isIdle }),
    [isDragAccept, isDragReject, isIdle],
  );

  const rootProps = getRootProps();

  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as MutableRefObject<HTMLDivElement | null>).current = node;
      }
      const dropzoneRef = rootProps.ref;
      if (typeof dropzoneRef === "function") {
        dropzoneRef(node);
      } else if (dropzoneRef) {
        (dropzoneRef as MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref, rootProps.ref],
  );

  return (
    <DropzoneContext.Provider value={contextValue}>
      <div
        {...props}
        {...rootProps}
        ref={mergedRef}
        className={cn(
          !unstyled &&
            "border-muted-foreground/25 bg-muted/50 hover:border-muted-foreground/50 hover:bg-muted data-[active=true]:border-primary data-[active=true]:bg-primary/5 data-[rejected=true]:border-destructive data-[rejected=true]:bg-destructive/5 focus-visible:ring-ring cursor-pointer rounded-lg border-2 border-dashed transition-colors focus-visible:outline-none focus-visible:ring-2 data-[accepted=true]:border-emerald-500 data-[accepted=true]:bg-emerald-500/5",
          config.disabled && "pointer-events-none opacity-50",
          className,
        )}
        data-active={isDragActive}
        data-accepted={isDragAccept}
        data-rejected={isDragReject}
      >
        <input {...getInputProps()} />
        {children}
      </div>
    </DropzoneContext.Provider>
  );
}

function DropzoneIdle({
  ref,
  ...props
}: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> }) {
  const { idle } = useContext(DropzoneContext);
  if (!idle) return null;
  return <div {...props} ref={ref} />;
}

function DropzoneAccepted({
  ref,
  ...props
}: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> }) {
  const { accept } = useContext(DropzoneContext);
  if (!accept) return null;
  return <div {...props} ref={ref} />;
}

function DropzoneRejected({
  ref,
  ...props
}: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> }) {
  const { reject } = useContext(DropzoneContext);
  if (!reject) return null;
  return <div {...props} ref={ref} />;
}

export { Dropzone, DropzoneAccepted, DropzoneIdle, DropzoneRejected };
