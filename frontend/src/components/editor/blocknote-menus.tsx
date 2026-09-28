'use client';

/**
 * BlockNote draws its menus inline, inside the editor, so a block menu near the
 * notes panel's edge was clipped by the panel or drawn under the divider. These
 * are the app's own menu components, rendered into a layer at the top of the
 * page instead. The layer carries BlockNote's container classes so its theme
 * variables and colour swatches still apply.
 */
import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import type { BlockNoteView } from '@blocknote/shadcn';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  menuItemClass,
} from '@/components/ui/dropdown-menu';

const LAYER_ID = 'af-blocknote-layer';
const LayerContext = React.createContext<HTMLElement | null>(null);

export const BlockNoteLayerProvider = LayerContext.Provider;

/** The shared layer for editor menus, kept in step with the light or dark theme. */
export function useBlockNoteLayer(dark: boolean): HTMLElement | null {
  const [layer, setLayer] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    let element = document.getElementById(LAYER_ID);
    if (!element) {
      element = document.createElement('div');
      element.id = LAYER_ID;
      element.className = 'bn-container bn-shadcn af-blocknote-layer';
      document.body.appendChild(element);
    }
    setLayer(element);
  }, []);
  React.useEffect(() => {
    if (!layer) return;
    layer.classList.toggle('dark', dark);
    layer.setAttribute('data-color-scheme', dark ? 'dark' : 'light');
  }, [layer, dark]);
  return layer;
}

/**
 * BlockNote freezes the + and drag handle while their menu is open and
 * unfreezes them when it closes. Radix reports the close from an effect, which
 * can run after the editor dropped that state (it reloads when a summary
 * arrives); BlockNote's unfreeze then throws and takes the page down. Nothing
 * is left to unfreeze in that case, so the error is dropped.
 */
function Root({ onOpenChange, ...props }: React.ComponentProps<typeof DropdownMenu>) {
  return (
    <DropdownMenu
      {...props}
      onOpenChange={(open) => {
        try {
          onOpenChange?.(open);
        } catch (error) {
          console.warn('[notes] block menu closed after its editor changed', error);
        }
      }}
    />
  );
}

const Content = React.forwardRef<
  React.ElementRef<typeof DropdownMenuContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuContent>
>((props, ref) => <DropdownMenuContent ref={ref} container={React.useContext(LayerContext)} {...props} />);
Content.displayName = 'BlockNoteMenuContent';

const SubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuSubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuSubContent>
>((props, ref) => <DropdownMenuSubContent ref={ref} container={React.useContext(LayerContext)} {...props} />);
SubContent.displayName = 'BlockNoteMenuSubContent';

/** BlockNote pads checked and unchecked rows differently; keep every row aligned, tick on the right. */
const CheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      menuItemClass,
      'pr-8',
      className
        ?.split(/\s+/)
        .filter((name) => !/^bn-(p[xylrtb]?|gap)-/.test(name))
        .join(' '),
    )}
    {...props}
  >
    {children}
    <span className="absolute right-2.5 flex h-4 w-4 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="!text-af-accent" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
  </DropdownMenuPrimitive.CheckboxItem>
));
CheckboxItem.displayName = 'BlockNoteMenuCheckboxItem';

type ShadCNOverrides = NonNullable<React.ComponentProps<typeof BlockNoteView>['shadCNComponents']>;

/** Pass as `shadCNComponents` to BlockNoteView, inside a BlockNoteLayerProvider. */
export const blockNoteMenus = {
  DropdownMenu: {
    DropdownMenu: Root,
    DropdownMenuCheckboxItem: CheckboxItem,
    DropdownMenuContent: Content,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent: SubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
  },
} as unknown as ShadCNOverrides;
