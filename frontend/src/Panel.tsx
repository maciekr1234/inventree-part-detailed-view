import {
  ApiEndpoints,
  apiUrl,
  checkPluginVersion,
  type InvenTreePluginContext
} from '@inventreedb/ui';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Stack,
  Table,
  Text,
  Title
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMemo } from 'react';

type DatasheetRecord = {
  id: number | string;
  label: string;
  url: string;
  comment?: string | null;
};

type ParameterRecord = {
  id: number | string;
  name: string;
  value: string;
  units?: string | null;
};

type PanelServerContext = {
  part?: {
    id?: number | string;
    name?: string;
    description?: string | null;
    active?: boolean;
    url?: string | null;
    thumbnail?: string | null;
  };
  datasheets?: DatasheetRecord[];
  parameters?: ParameterRecord[];
  meta?: {
    inventree_version?: string;
    plugin_version?: string;
  };
};

function PartDetailedViewPanel({
  context
}: {
  context: InvenTreePluginContext;
}) {
  const serverContext = (context.context ?? {}) as PanelServerContext;
  const datasheets = serverContext.datasheets ?? [];
  const parameters = serverContext.parameters ?? [];
  const partSummary = serverContext.part ?? {};

  const partId = partSummary.id ?? context.id ?? null;

  const editPartForm = useMemo(() => {
    if (!partId) {
      return null;
    }

    return context.forms.edit({
      url: apiUrl(ApiEndpoints.part_list, partId),
      title: 'Edit Part',
      fields: {
        name: {},
        description: {},
        category: {}
      },
      successMessage: null,
      onFormSuccess: () => {
        notifications.show({
          title: 'Part updated',
          message: 'The part was saved successfully.',
          color: 'green'
        });
        context.reloadInstance?.();
      }
    });
  }, [context, partId]);

  const parametersTable = useMemo(() => {
    if (!parameters.length) {
      return (
        <Alert color='yellow' title='No parameters'>
          Add part parameters to make them visible in this panel.
        </Alert>
      );
    }

    return (
      <Table striped withColumnBorders highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Value</Table.Th>
            <Table.Th w='20%'>Units</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {parameters.map((parameter) => (
            <Table.Tr key={parameter.id}>
              <Table.Td>{parameter.name}</Table.Td>
              <Table.Td>{parameter.value}</Table.Td>
              <Table.Td>{parameter.units || '-'}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  }, [parameters]);

  return (
    <>
      {editPartForm?.modal}
      <Stack gap='md'>
        <Group justify='space-between' align='flex-start'>
          <div>
            <Title c={context.theme.primaryColor} order={3}>
              {partSummary.name || 'Part details'}
            </Title>
            {partSummary.description && (
              <Text c='dimmed' size='sm'>
                {partSummary.description}
              </Text>
            )}
            <Group gap='xs' mt='xs'>
              {partSummary.active === false && (
                <Badge color='gray'>Inactive</Badge>
              )}
              {serverContext.meta?.plugin_version && (
                <Badge color='blue' variant='light'>
                  Plugin v{serverContext.meta.plugin_version}
                </Badge>
              )}
              {serverContext.meta?.inventree_version && (
                <Badge color='grape' variant='light'>
                  InvenTree {serverContext.meta.inventree_version}
                </Badge>
              )}
            </Group>
          </div>
          <Group gap='xs'>
            {partSummary.url && (
              <Anchor
                href={partSummary.url}
                target='_blank'
                rel='noopener noreferrer'
              >
                Open part page
              </Anchor>
            )}
            {editPartForm && (
              <Button size='xs' onClick={() => editPartForm.open()}>
                Edit part
              </Button>
            )}
          </Group>
        </Group>

        <Card withBorder padding='md' radius='md'>
          <Stack gap='sm'>
            <Title order={4}>Datasheet links</Title>
            {!datasheets.length && (
              <Alert color='yellow' title='No datasheets found'>
                Attach a file or external link with a "datasheet" comment to see
                it here.
              </Alert>
            )}
            {datasheets.length > 0 && (
              <Stack gap={4}>
                {datasheets.map((file) => (
                  <Anchor
                    key={file.id}
                    href={file.url}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    {file.label}
                    {file.comment ? ` — ${file.comment}` : ''}
                  </Anchor>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>

        <Card withBorder padding='md' radius='md'>
          <Stack gap='sm'>
            <Title order={4}>Parameters</Title>
            {parametersTable}
          </Stack>
        </Card>

        <Divider />
        <Text size='xs' c='dimmed'>
          Panel provided by Part Detailed View plugin.
        </Text>
      </Stack>
    </>
  );
}

export function renderPartDetailedViewPanel(context: InvenTreePluginContext) {
  checkPluginVersion(context);
  return <PartDetailedViewPanel context={context} />;
}
